import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { CollectionEntry } from "@/domain/collection/collection";
import { MAX_COLLECTION_QUANTITY } from "@/domain/collection/schema";
import { getDeckCardData } from "@/server/cards/search";
import { type Database, getDb } from "@/server/db";
import { cards, collectionCards } from "@/server/db/schema";
import { trimCopiesToOwned } from "@/server/decks/copies";

/** Base de données, ou transaction en cours. */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

// Collection de cartes. Chaque fonction reçoit l'identifiant de l'utilisateur
// et ne lit ou n'écrit que sa propre collection.

export interface Collection {
  entries: CollectionEntry[];
  /** Nombre total d'exemplaires. */
  total: number;
  priceEur: number;
  priceUsd: number;
}

/** Collection de l'utilisateur, triée par nom de carte. */
export async function getCollection(userId: string): Promise<Collection> {
  // Une carte retirée par Scryfall reste en base mais n'est pas affichée.
  const entries = await getDb()
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      typeLine: cards.typeLine,
      types: cards.types,
      manaValue: cards.manaValue,
      colorIdentity: cards.colorIdentity,
      rarity: cards.rarity,
      gameChanger: cards.gameChanger,
      priceEur: cards.priceEur,
      priceUsd: cards.priceUsd,
      imageUris: cards.imageUris,
      quantity: collectionCards.quantity,
      addedAt: collectionCards.createdAt,
    })
    .from(collectionCards)
    .innerJoin(cards, eq(cards.oracleId, collectionCards.oracleId))
    .where(eq(collectionCards.userId, userId))
    .orderBy(asc(cards.name));
  return {
    entries,
    total: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    priceEur: entries.reduce(
      (sum, entry) => sum + (entry.priceEur ?? 0) * entry.quantity,
      0,
    ),
    priceUsd: entries.reduce(
      (sum, entry) => sum + (entry.priceUsd ?? 0) * entry.quantity,
      0,
    ),
  };
}

export type ChangeCollectionResult =
  | { ok: true; quantity: number }
  | { ok: false; error: "unknownCard" };

/**
 * Ajoute (`delta` positif) ou retire des exemplaires d'une carte ; la carte
 * quitte la collection quand il n'en reste plus. Renvoie la nouvelle quantité.
 */
export async function changeCollectionCard(
  userId: string,
  oracleId: string,
  delta: number,
  db: DbExecutor = getDb(),
): Promise<ChangeCollectionResult> {
  const [card] = await getDeckCardData([oracleId]);
  if (!card) return { ok: false, error: "unknownCard" };

  if (delta < 0) {
    const [row] = await db
      .update(collectionCards)
      .set({
        quantity: sql`${collectionCards.quantity} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionCards.userId, userId),
          eq(collectionCards.oracleId, oracleId),
        ),
      )
      .returning({ quantity: collectionCards.quantity });
    // Les exemplaires retirés de la collection quittent aussi les decks.
    await trimCopiesToOwned(
      db,
      userId,
      oracleId,
      Math.max(0, row?.quantity ?? 0),
    );
    if (!row || row.quantity > 0)
      return { ok: true, quantity: row?.quantity ?? 0 };
    await db
      .delete(collectionCards)
      .where(
        and(
          eq(collectionCards.userId, userId),
          eq(collectionCards.oracleId, oracleId),
          lte(collectionCards.quantity, 0),
        ),
      );
    return { ok: true, quantity: 0 };
  }

  const [row] = await db
    .insert(collectionCards)
    .values({ userId, oracleId, quantity: delta })
    .onConflictDoUpdate({
      target: [collectionCards.userId, collectionCards.oracleId],
      set: {
        quantity: sql`least(${collectionCards.quantity} + ${delta}, ${MAX_COLLECTION_QUANTITY})`,
        updatedAt: new Date(),
      },
    })
    .returning({ quantity: collectionCards.quantity });
  return { ok: true, quantity: row.quantity };
}

/**
 * Ajoute des exemplaires de plusieurs cartes (import d'une liste), en une
 * transaction. Les cartes inconnues sont ignorées ; une même carte listée
 * deux fois compte deux fois. Renvoie le nombre de cartes et d'exemplaires
 * ajoutés.
 */
export async function addCollectionCards(
  userId: string,
  entries: readonly { oracleId: string; quantity: number }[],
): Promise<{ cards: number; copies: number }> {
  const totals = new Map<string, number>();
  for (const { oracleId, quantity } of entries) {
    totals.set(
      oracleId,
      Math.min((totals.get(oracleId) ?? 0) + quantity, MAX_COLLECTION_QUANTITY),
    );
  }
  if (totals.size === 0) return { cards: 0, copies: 0 };

  const db = getDb();
  const known = await db
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(inArray(cards.oracleId, [...totals.keys()]));
  const rows = known.map(({ oracleId }) => ({
    userId,
    oracleId,
    quantity: totals.get(oracleId) ?? 0,
  }));
  if (rows.length === 0) return { cards: 0, copies: 0 };

  await db
    .insert(collectionCards)
    .values(rows)
    .onConflictDoUpdate({
      target: [collectionCards.userId, collectionCards.oracleId],
      set: {
        quantity: sql`least(${collectionCards.quantity} + excluded.quantity, ${MAX_COLLECTION_QUANTITY})`,
        updatedAt: new Date(),
      },
    });
  return {
    cards: rows.length,
    copies: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
}
