import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { MAX_COLLECTION_QUANTITY } from "@/domain/collection/schema";
import type { DeckCardData } from "@/domain/deck/deck";
import { getDeckCardData } from "@/server/cards/search";
import { type Database, getDb } from "@/server/db";
import { collectionCards } from "@/server/db/schema";

/** Base de données, ou transaction en cours. */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

// Collection de cartes. Chaque fonction reçoit l'identifiant de l'utilisateur
// et ne lit ou n'écrit que sa propre collection.

/** Une carte de la collection et son nombre d'exemplaires. */
export interface CollectionEntry {
  card: DeckCardData;
  quantity: number;
}

export interface Collection {
  entries: CollectionEntry[];
  /** Nombre total d'exemplaires. */
  total: number;
  priceEur: number;
  priceUsd: number;
}

/** Collection de l'utilisateur, triée par nom de carte. */
export async function getCollection(userId: string): Promise<Collection> {
  const rows = await getDb()
    .select({
      oracleId: collectionCards.oracleId,
      quantity: collectionCards.quantity,
    })
    .from(collectionCards)
    .where(eq(collectionCards.userId, userId));
  const cards = new Map(
    (await getDeckCardData(rows.map((row) => row.oracleId))).map((card) => [
      card.oracleId,
      card,
    ]),
  );
  // Une carte retirée par Scryfall reste en base mais n'est pas affichée.
  const entries = rows
    .flatMap(({ oracleId, quantity }) => {
      const card = cards.get(oracleId);
      return card ? [{ card, quantity }] : [];
    })
    .sort((a, b) => a.card.name.localeCompare(b.card.name, "en"));
  return {
    entries,
    total: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    priceEur: entries.reduce(
      (sum, entry) => sum + (entry.card.priceEur ?? 0) * entry.quantity,
      0,
    ),
    priceUsd: entries.reduce(
      (sum, entry) => sum + (entry.card.priceUsd ?? 0) * entry.quantity,
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
