import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  type DeckHolding,
  deckNeeds,
  fillWithFreeCopies,
  freeCopies,
  type Quantities,
  trimToOwned,
} from "@/domain/collection/ownership";
import type { TakeCopy } from "@/domain/collection/schema";
import type { DbExecutor } from "@/server/collection/collection";
import { getDb } from "@/server/db";
import {
  collectionCards,
  deckCardCopies,
  deckCards,
  decks,
} from "@/server/db/schema";

// Exemplaires physiques de la collection rangés dans les decks. Chaque
// fonction reçoit l'identifiant de l'utilisateur et ne touche qu'à ses propres
// decks et à sa propre collection.

/** Decks de l'utilisateur avec leurs besoins et leurs exemplaires physiques. */
export async function getDeckHoldings(
  userId: string,
  db: DbExecutor = getDb(),
): Promise<DeckHolding[]> {
  const owned = await db
    .select({ id: decks.id, name: decks.name, assembled: decks.assembled })
    .from(decks)
    .where(eq(decks.userId, userId))
    .orderBy(asc(decks.name));
  if (owned.length === 0) return [];
  const ids = owned.map((deck) => deck.id);

  const [entries, copies] = await Promise.all([
    db
      .select({
        deckId: deckCards.deckId,
        oracleId: deckCards.oracleId,
        zone: deckCards.zone,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(inArray(deckCards.deckId, ids)),
    db
      .select({
        deckId: deckCardCopies.deckId,
        oracleId: deckCardCopies.oracleId,
        quantity: deckCardCopies.quantity,
      })
      .from(deckCardCopies)
      .where(inArray(deckCardCopies.deckId, ids)),
  ]);

  return owned.map((deck) => ({
    deckId: deck.id,
    name: deck.name,
    assembled: deck.assembled,
    needs: deckNeeds(entries.filter((entry) => entry.deckId === deck.id)),
    copies: Object.fromEntries(
      copies
        .filter((copy) => copy.deckId === deck.id)
        .map((copy) => [copy.oracleId, copy.quantity]),
    ),
  }));
}

/** Exemplaires possédés par l'utilisateur, par carte. */
export async function getOwnedQuantities(
  userId: string,
  oracleIds?: readonly string[],
  db: DbExecutor = getDb(),
): Promise<Quantities> {
  if (oracleIds?.length === 0) return {};
  const rows = await db
    .select({
      oracleId: collectionCards.oracleId,
      quantity: collectionCards.quantity,
    })
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.userId, userId),
        oracleIds
          ? inArray(collectionCards.oracleId, [...oracleIds])
          : undefined,
      ),
    );
  return Object.fromEntries(rows.map((row) => [row.oracleId, row.quantity]));
}

/** Remplace le nombre d'exemplaires d'une carte dans un deck (0 : aucun). */
async function setCopies(
  db: DbExecutor,
  deckId: string,
  oracleId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await db
      .delete(deckCardCopies)
      .where(
        and(
          eq(deckCardCopies.deckId, deckId),
          eq(deckCardCopies.oracleId, oracleId),
        ),
      );
    return;
  }
  await db
    .insert(deckCardCopies)
    .values({ deckId, oracleId, quantity })
    .onConflictDoUpdate({
      target: [deckCardCopies.deckId, deckCardCopies.oracleId],
      set: { quantity },
    });
}

/**
 * Verrouille les decks de l'utilisateur le temps de la transaction : deux
 * changements d'exemplaires simultanés ne peuvent pas donner le même
 * exemplaire libre à deux decks.
 */
async function lockUserDecks(db: DbExecutor, userId: string): Promise<void> {
  await db.execute(
    sql`select 1 from ${decks} where ${decks.userId} = ${userId} for update`,
  );
}

/**
 * Monte un deck (il reçoit les exemplaires libres de la collection) ou le
 * remet en construction (ses exemplaires redeviennent libres). Renvoie false
 * si le deck n'existe pas ou appartient à quelqu'un d'autre.
 */
export async function setDeckAssembled(
  userId: string,
  deckId: string,
  assembled: boolean,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await lockUserDecks(tx, userId);
    const [deck] = await tx
      .update(decks)
      .set({ assembled })
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .returning({ id: decks.id });
    if (!deck) return false;

    if (!assembled) {
      await tx.delete(deckCardCopies).where(eq(deckCardCopies.deckId, deckId));
      return true;
    }
    const holdings = await getDeckHoldings(userId, tx);
    const owned = await getOwnedQuantities(userId, undefined, tx);
    const current = holdings.find((holding) => holding.deckId === deckId);
    const copies = fillWithFreeCopies(deckId, owned, holdings);
    for (const [oracleId, quantity] of Object.entries(copies)) {
      if (current?.copies[oracleId] !== quantity) {
        await setCopies(tx, deckId, oracleId, quantity);
      }
    }
    return true;
  });
}

export type TakeCopyResult =
  | { ok: true }
  | { ok: false; error: "notFound" | "notNeeded" | "unavailable" };

/**
 * Range un exemplaire physique d'une carte dans un deck, pris parmi les
 * exemplaires libres ou dans un autre deck. Le deck qui le reçoit devient
 * monté ; celui qui le perd repasse construit s'il était jouable.
 */
export async function takeCopy(
  userId: string,
  deckId: string,
  { oracleId, fromDeckId }: TakeCopy,
): Promise<TakeCopyResult> {
  return getDb().transaction(async (tx) => {
    await lockUserDecks(tx, userId);
    const holdings = await getDeckHoldings(userId, tx);
    const target = holdings.find((holding) => holding.deckId === deckId);
    if (!target) return { ok: false, error: "notFound" } as const;
    const current = target.copies[oracleId] ?? 0;
    if ((target.needs[oracleId] ?? 0) <= current) {
      return { ok: false, error: "notNeeded" } as const;
    }

    if (fromDeckId) {
      const source = holdings.find((holding) => holding.deckId === fromDeckId);
      if (!source || fromDeckId === deckId) {
        return { ok: false, error: "notFound" } as const;
      }
      const available = source.copies[oracleId] ?? 0;
      if (available <= 0) return { ok: false, error: "unavailable" } as const;
      await setCopies(tx, fromDeckId, oracleId, available - 1);
    } else {
      const owned = await getOwnedQuantities(userId, [oracleId], tx);
      if (freeCopies(owned[oracleId] ?? 0, holdings, oracleId) <= 0) {
        return { ok: false, error: "unavailable" } as const;
      }
    }
    await setCopies(tx, deckId, oracleId, current + 1);
    if (!target.assembled) {
      await tx
        .update(decks)
        .set({ assembled: true })
        .where(eq(decks.id, deckId));
    }
    return { ok: true } as const;
  });
}

/**
 * Ramène les exemplaires d'un deck à ce qu'il demande, après une
 * modification de ses cartes. À appeler dans la transaction de la sauvegarde.
 */
export async function clampDeckCopies(
  db: DbExecutor,
  deckId: string,
  needs: Quantities,
): Promise<void> {
  const copies = await db
    .select({
      oracleId: deckCardCopies.oracleId,
      quantity: deckCardCopies.quantity,
    })
    .from(deckCardCopies)
    .where(eq(deckCardCopies.deckId, deckId));
  for (const copy of copies) {
    const need = needs[copy.oracleId] ?? 0;
    if (copy.quantity > need) {
      await setCopies(db, deckId, copy.oracleId, need);
    }
  }
}

/**
 * Retire des decks les exemplaires d'une carte que la collection ne possède
 * plus (après un retrait d'exemplaires). Les decks modifiés le moins
 * récemment perdent leurs exemplaires en premier.
 */
export async function trimCopiesToOwned(
  db: DbExecutor,
  userId: string,
  oracleId: string,
  owned: number,
): Promise<void> {
  const rows = await db
    .select({ deckId: deckCardCopies.deckId, copies: deckCardCopies.quantity })
    .from(deckCardCopies)
    .innerJoin(decks, eq(decks.id, deckCardCopies.deckId))
    .where(and(eq(decks.userId, userId), eq(deckCardCopies.oracleId, oracleId)))
    .orderBy(asc(decks.updatedAt));
  for (const change of trimToOwned(owned, rows)) {
    await setCopies(db, change.deckId, oracleId, change.copies);
  }
}

/** Ce que l'éditeur d'un deck doit savoir des exemplaires physiques. */
export interface DeckOwnership {
  assembled: boolean;
  /** Collection de l'utilisateur, par carte. */
  owned: Quantities;
  /** Exemplaires rangés dans chaque deck de l'utilisateur, celui-ci compris. */
  holdings: { deckId: string; name: string; copies: Quantities }[];
}

/** Exemplaires physiques vus depuis un deck ; null s'il n'est pas à l'utilisateur. */
export async function getDeckOwnership(
  userId: string,
  deckId: string,
): Promise<DeckOwnership | null> {
  const [holdings, owned] = await Promise.all([
    getDeckHoldings(userId),
    getOwnedQuantities(userId),
  ]);
  const deck = holdings.find((holding) => holding.deckId === deckId);
  if (!deck) return null;
  return {
    assembled: deck.assembled,
    owned,
    holdings: holdings.map(({ deckId, name, copies }) => ({
      deckId,
      name,
      copies,
    })),
  };
}
