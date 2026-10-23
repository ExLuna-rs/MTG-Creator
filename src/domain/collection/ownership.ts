import type { DeckEntry } from "../deck/deck";

// Exemplaires physiques des cartes de la collection rangés dans les decks.
//
// Un deck « monté » contient des exemplaires physiques de ses cartes : il est
// construit s'il lui en manque, jouable s'il les a toutes. Un deck en
// construction n'en contient aucun : ses cartes sont présentes dans le deck
// sans y être utilisées. Les cartes « à considérer » ne comptent jamais.

/** Statuts d'un deck, du moins avancé au plus avancé. */
export const DECK_STATUSES = ["building", "built", "playable"] as const;

export type DeckStatus = (typeof DECK_STATUSES)[number];

/** Quantité par carte (`oracle_id`). */
export type Quantities = Record<string, number>;

/** Un deck vu par la collection : ses besoins et ses exemplaires physiques. */
export interface DeckHolding {
  deckId: string;
  name: string;
  assembled: boolean;
  /** Exemplaires demandés par le deck (commandants et deck, sans « à considérer »). */
  needs: Quantities;
  /** Exemplaires physiques rangés dans le deck (jamais plus que `needs`). */
  copies: Quantities;
}

/** Exemplaires demandés par un deck, toutes zones jouées confondues. */
export function deckNeeds(
  entries: readonly Pick<DeckEntry, "oracleId" | "zone" | "quantity">[],
): Quantities {
  const needs: Quantities = {};
  for (const entry of entries) {
    if (entry.zone === "maybe") continue;
    needs[entry.oracleId] = (needs[entry.oracleId] ?? 0) + entry.quantity;
  }
  return needs;
}

/** Cartes du deck sans exemplaire physique, avec le nombre manquant. */
export function missingCopies(
  needs: Quantities,
  copies: Quantities,
): { oracleId: string; missing: number }[] {
  return Object.entries(needs)
    .map(([oracleId, need]) => ({
      oracleId,
      missing: need - (copies[oracleId] ?? 0),
    }))
    .filter((card) => card.missing > 0);
}

/** Statut d'un deck d'après ses exemplaires physiques. */
export function deckStatus(
  assembled: boolean,
  needs: Quantities,
  copies: Quantities,
): DeckStatus {
  if (!assembled) return "building";
  return missingCopies(needs, copies).length > 0 ? "built" : "playable";
}

/** Exemplaires d'une carte rangés dans l'ensemble des decks. */
export function usedCopies(
  holdings: readonly Pick<DeckHolding, "copies">[],
  oracleId: string,
): number {
  return holdings.reduce(
    (total, holding) => total + (holding.copies[oracleId] ?? 0),
    0,
  );
}

/** Exemplaires possédés qui ne sont rangés dans aucun deck. */
export function freeCopies(
  owned: number,
  holdings: readonly Pick<DeckHolding, "copies">[],
  oracleId: string,
): number {
  return Math.max(0, owned - usedCopies(holdings, oracleId));
}

/** Où se trouve une carte de la collection. */
export interface CardUsage {
  /** Exemplaires rangés dans des decks. */
  used: number;
  /** Exemplaires rangés dans aucun deck. */
  free: number;
  /** Exemplaires qui manquent aux decks montés, une fois les libres donnés. */
  missing: number;
  /** Decks qui contiennent un exemplaire physique de la carte. */
  usedIn: { deckId: string; copies: number }[];
  /** Decks qui contiennent la carte sans (assez d')exemplaire physique. */
  wantedBy: { deckId: string; missing: number }[];
}

export function cardUsage(
  oracleId: string,
  owned: number,
  holdings: readonly DeckHolding[],
): CardUsage {
  const usedIn: CardUsage["usedIn"] = [];
  const wantedBy: CardUsage["wantedBy"] = [];
  let lacking = 0;
  for (const holding of holdings) {
    const copies = holding.copies[oracleId] ?? 0;
    const missing = (holding.needs[oracleId] ?? 0) - copies;
    if (copies > 0) usedIn.push({ deckId: holding.deckId, copies });
    if (missing > 0) {
      wantedBy.push({ deckId: holding.deckId, missing });
      if (holding.assembled) lacking += missing;
    }
  }
  const used = usedCopies(holdings, oracleId);
  const free = Math.max(0, owned - used);
  return {
    used,
    free,
    missing: Math.max(0, lacking - free),
    usedIn,
    wantedBy,
  };
}

/**
 * Exemplaires du deck une fois complétés avec les exemplaires libres de la
 * collection (quand on monte le deck).
 */
export function fillWithFreeCopies(
  deckId: string,
  owned: Quantities,
  holdings: readonly DeckHolding[],
): Quantities {
  const deck = holdings.find((holding) => holding.deckId === deckId);
  if (!deck) return {};
  const copies: Quantities = { ...deck.copies };
  for (const [oracleId, need] of Object.entries(deck.needs)) {
    const current = copies[oracleId] ?? 0;
    const free = freeCopies(owned[oracleId] ?? 0, holdings, oracleId);
    const next = Math.min(need, current + free);
    if (next > 0) copies[oracleId] = next;
  }
  return copies;
}

/** Exemplaires ramenés aux besoins du deck (après une modification du deck). */
export function clampToNeeds(
  copies: Quantities,
  needs: Quantities,
): Quantities {
  const clamped: Quantities = {};
  for (const [oracleId, count] of Object.entries(copies)) {
    const next = Math.min(count, needs[oracleId] ?? 0);
    if (next > 0) clamped[oracleId] = next;
  }
  return clamped;
}

/**
 * Exemplaires à retirer des decks quand la collection n'en a plus assez :
 * on retire d'abord ceux des premiers decks de la liste. Renvoie le nouveau
 * nombre d'exemplaires des decks touchés.
 */
export function trimToOwned(
  owned: number,
  decks: readonly { deckId: string; copies: number }[],
): { deckId: string; copies: number }[] {
  let excess = decks.reduce((total, deck) => total + deck.copies, 0) - owned;
  const changes: { deckId: string; copies: number }[] = [];
  for (const deck of decks) {
    if (excess <= 0) break;
    const removed = Math.min(deck.copies, excess);
    excess -= removed;
    changes.push({ deckId: deck.deckId, copies: deck.copies - removed });
  }
  return changes;
}
