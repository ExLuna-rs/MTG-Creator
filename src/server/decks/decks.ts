import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { canPair } from "@/domain/commander/partners";
import { validateCommanderDeck } from "@/domain/commander/validate";
import type { DeckCard, DeckCardData, DeckEntry } from "@/domain/deck/deck";
import type { DeckSave, NewDeck } from "@/domain/deck/schema";
import { computeDeckStats } from "@/domain/deck/stats";
import { getDeckCardData } from "@/server/cards/search";
import { getDb } from "@/server/db";
import { deckCards, decks } from "@/server/db/schema";

// Accès aux decks. Chaque fonction reçoit l'identifiant de l'utilisateur
// connecté et ne lit ou n'écrit que ses propres decks : l'appartenance est
// vérifiée dans la requête elle-même, pas seulement par l'appelant.

export interface OwnedDeck {
  id: string;
  name: string;
  updatedAt: Date;
  entries: DeckEntry[];
  cards: DeckCardData[];
}

export type CreateDeckResult =
  | { ok: true; deckId: string }
  | { ok: false; error: "unknownCard" | "notACommander" | "invalidPair" };

/**
 * Crée un deck Commander autour d'un commandant (et de son partenaire ou
 * Background), après avoir vérifié qu'ils peuvent l'être.
 */
export async function createDeck(
  userId: string,
  { commanderId, partnerId, name }: NewDeck,
): Promise<CreateDeckResult> {
  const ids = partnerId ? [commanderId, partnerId] : [commanderId];
  const found = await getDeckCardData(ids);
  const commander = found.find((card) => card.oracleId === commanderId);
  const partner = found.find((card) => card.oracleId === partnerId);
  if (!commander || (partnerId && !partner)) {
    return { ok: false, error: "unknownCard" };
  }
  if (!commander.canBeCommander || commander.commanderLegality !== "legal") {
    return { ok: false, error: "notACommander" };
  }
  if (
    partner &&
    (partner.commanderLegality !== "legal" || !canPair(commander, partner))
  ) {
    return { ok: false, error: "invalidPair" };
  }

  const deckName =
    name ||
    [commander, partner]
      .filter(Boolean)
      .map((card) => card?.name)
      .join(" & ");
  const deckId = await getDb().transaction(async (tx) => {
    const [deck] = await tx
      .insert(decks)
      .values({
        userId,
        name: deckName.slice(0, 100),
        coverOracleId: commander.oracleId,
      })
      .returning({ id: decks.id });
    await tx.insert(deckCards).values(
      ids.map((oracleId) => ({
        deckId: deck.id,
        oracleId,
        zone: "commander" as const,
        quantity: 1,
        categories: [],
      })),
    );
    return deck.id;
  });
  return { ok: true, deckId };
}

/**
 * Deck de l'utilisateur, avec ses cartes, ou null s'il n'existe pas ou
 * appartient à quelqu'un d'autre. Une carte disparue de la base (retirée par
 * Scryfall) n'est pas renvoyée.
 */
export async function getOwnedDeck(
  userId: string,
  deckId: string,
): Promise<OwnedDeck | null> {
  const db = getDb();
  const [deck] = await db
    .select({ id: decks.id, name: decks.name, updatedAt: decks.updatedAt })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  if (!deck) return null;

  const rows = await db
    .select({
      oracleId: deckCards.oracleId,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      categories: deckCards.categories,
    })
    .from(deckCards)
    .where(eq(deckCards.deckId, deck.id));
  const cards = await getDeckCardData(rows.map((row) => row.oracleId));
  const known = new Set(cards.map((card) => card.oracleId));
  return {
    ...deck,
    entries: rows.filter((row) => known.has(row.oracleId)),
    cards,
  };
}

export type SaveDeckResult =
  | { ok: true; updatedAt: Date }
  | { ok: false; error: "notFound" | "unknownCard" };

/** Remplace le nom et les cartes d'un deck de l'utilisateur. */
export async function saveDeck(
  userId: string,
  deckId: string,
  { name, entries }: DeckSave,
): Promise<SaveDeckResult> {
  const oracleIds = [...new Set(entries.map((entry) => entry.oracleId))];
  const known = await getDeckCardData(oracleIds);
  if (known.length !== oracleIds.length) {
    return { ok: false, error: "unknownCard" };
  }

  return getDb().transaction(async (tx) => {
    const [deck] = await tx
      .update(decks)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .returning({ id: decks.id, updatedAt: decks.updatedAt });
    if (!deck) return { ok: false, error: "notFound" } as const;

    await tx.delete(deckCards).where(eq(deckCards.deckId, deck.id));
    if (entries.length > 0) {
      await tx
        .insert(deckCards)
        .values(entries.map((entry) => ({ ...entry, deckId: deck.id })));
    }
    return { ok: true, updatedAt: deck.updatedAt } as const;
  });
}

/** Supprime un deck de l'utilisateur ; renvoie false s'il n'existe pas. */
export async function deleteDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .returning({ id: decks.id });
  return deleted.length > 0;
}

/** Résumé d'un deck pour la page « Mes decks ». */
export interface DeckSummary {
  id: string;
  name: string;
  updatedAt: Date;
  commanders: Pick<DeckCardData, "oracleId" | "name" | "imageUris">[];
  colorIdentity: number;
  cardCount: number;
  valid: boolean;
  priceEur: number;
  priceUsd: number;
}

/** Decks de l'utilisateur, du plus récemment modifié au plus ancien. */
export async function listDecks(userId: string): Promise<DeckSummary[]> {
  const db = getDb();
  const owned = await db
    .select({ id: decks.id, name: decks.name, updatedAt: decks.updatedAt })
    .from(decks)
    .where(eq(decks.userId, userId))
    .orderBy(desc(decks.updatedAt));
  if (owned.length === 0) return [];

  const rows = await db
    .select({
      deckId: deckCards.deckId,
      oracleId: deckCards.oracleId,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      categories: deckCards.categories,
    })
    .from(deckCards)
    .where(
      inArray(
        deckCards.deckId,
        owned.map((deck) => deck.id),
      ),
    );
  const cards = new Map(
    (await getDeckCardData(rows.map((row) => row.oracleId))).map((card) => [
      card.oracleId,
      card,
    ]),
  );

  return owned.map((deck) => {
    const entries: DeckCard[] = rows.flatMap(({ deckId, ...row }) => {
      const card = cards.get(row.oracleId);
      return deckId === deck.id && card ? [{ ...row, card }] : [];
    });
    const validation = validateCommanderDeck(entries);
    const stats = computeDeckStats(entries);
    return {
      ...deck,
      commanders: entries
        .filter((entry) => entry.zone === "commander")
        .map(({ card }) => ({
          oracleId: card.oracleId,
          name: card.name,
          imageUris: card.imageUris,
        })),
      colorIdentity: validation.colorIdentity,
      cardCount: validation.size,
      valid: validation.valid,
      priceEur: stats.price.eur,
      priceUsd: stats.price.usd,
    };
  });
}
