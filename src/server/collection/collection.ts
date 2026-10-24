import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { CardSearch } from "@/domain/cards/search-query";
import type { CollectionEntry } from "@/domain/collection/collection";
import { copiesValue, type PrintingSplit } from "@/domain/collection/printings";
import { MAX_COLLECTION_QUANTITY } from "@/domain/collection/schema";
import { cardFilterConditions, getDeckCardData } from "@/server/cards/search";
import { type Database, getDb } from "@/server/db";
import { cards, collectionCards } from "@/server/db/schema";
import { trimCopiesToOwned } from "@/server/decks/copies";
import { addToBinder, ownsBinder, trimBindersToOwned } from "./binders";
import {
  addPrintingCopies,
  getPrintingSplits,
  trimPrintingsToOwned,
} from "./printings";

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
  /** Valeur, d'après l'édition et la finition de chaque exemplaire. */
  priceEur: number;
  priceUsd: number;
  /** Exemplaires dont l'édition est précisée, par carte. */
  printings: Record<string, PrintingSplit>;
}

/** Collection de l'utilisateur, triée par nom de carte. */
export async function getCollection(userId: string): Promise<Collection> {
  // Une carte retirée par Scryfall reste en base mais n'est pas affichée.
  const entriesQuery = getDb()
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
  const [entries, printings] = await Promise.all([
    entriesQuery,
    getPrintingSplits(userId),
  ]);
  const value = (currency: "EUR" | "USD") =>
    entries.reduce(
      (sum, entry) =>
        sum +
        copiesValue(
          entry.quantity,
          currency === "EUR" ? entry.priceEur : entry.priceUsd,
          printings[entry.oracleId] ?? [],
          currency,
        ),
      0,
    );
  return {
    entries,
    total: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    priceEur: value("EUR"),
    priceUsd: value("USD"),
    printings,
  };
}

/**
 * Cartes de la collection de l'utilisateur qui passent les filtres de la
 * recherche de cartes (couleurs, types, rareté…), par `oracle_id`.
 */
export async function filterCollection(
  userId: string,
  search: CardSearch,
): Promise<Set<string>> {
  const rows = await getDb()
    .select({ oracleId: cards.oracleId })
    .from(collectionCards)
    .innerJoin(cards, eq(cards.oracleId, collectionCards.oracleId))
    .where(
      and(eq(collectionCards.userId, userId), ...cardFilterConditions(search)),
    );
  return new Set(rows.map((row) => row.oracleId));
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
    // Les exemplaires retirés de la collection quittent aussi les decks et
    // les classeurs.
    const owned = Math.max(0, row?.quantity ?? 0);
    await trimCopiesToOwned(db, userId, oracleId, owned);
    await trimBindersToOwned(db, userId, oracleId, owned);
    await trimPrintingsToOwned(db, userId, oracleId, owned);
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
 * deux fois compte deux fois. Avec `binderId`, les exemplaires ajoutés sont
 * aussi rangés dans ce classeur. Renvoie le nombre de cartes et
 * d'exemplaires ajoutés, ou null si le classeur n'est pas à l'utilisateur.
 */
export async function addCollectionCards(
  userId: string,
  entries: readonly {
    oracleId: string;
    quantity: number;
    /** Édition et finition indiquées par la liste (« (LEA) 269 *F* »). */
    printingId?: string;
    foil?: boolean;
  }[],
  binderId?: string,
): Promise<{ cards: number; copies: number } | null> {
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

  if (binderId && !(await ownsBinder(userId, binderId))) return null;
  await db.transaction(async (tx) => {
    await tx
      .insert(collectionCards)
      .values(rows)
      .onConflictDoUpdate({
        target: [collectionCards.userId, collectionCards.oracleId],
        set: {
          quantity: sql`least(${collectionCards.quantity} + excluded.quantity, ${MAX_COLLECTION_QUANTITY})`,
          updatedAt: new Date(),
        },
      });
    if (binderId) {
      const added = new Map(rows.map((row) => [row.oracleId, row.quantity]));
      await addToBinder(tx, userId, binderId, added);
    }
    await addPrintingCopies(
      tx,
      userId,
      entries.flatMap(({ oracleId, quantity, printingId, foil = false }) =>
        printingId ? [{ oracleId, printingId, foil, quantity }] : [],
      ),
    );
  });
  return {
    cards: rows.length,
    copies: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
}
