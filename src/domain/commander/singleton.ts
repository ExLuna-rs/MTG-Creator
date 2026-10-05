import type { DeckCardData } from "../deck/deck";

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
};

/**
 * Nombre maximal d'exemplaires d'une carte dans un deck Commander : un seul,
 * sauf les terrains de base et les cartes qui disent le contraire
 * (« A deck can have any number of cards named… », « …up to seven cards
 * named… »). `Infinity` quand il n'y a pas de limite.
 */
export function maxCopies(
  card: Pick<DeckCardData, "supertypes" | "types" | "oracleText">,
): number {
  if (card.supertypes.includes("Basic") && card.types.includes("Land")) {
    return Number.POSITIVE_INFINITY;
  }
  const text = card.oracleText ?? "";
  if (/A deck can have any number of cards named/i.test(text)) {
    return Number.POSITIVE_INFINITY;
  }
  const upTo = text.match(/A deck can have up to (\w+) cards named/i);
  if (upTo) {
    const word = upTo[1].toLowerCase();
    const count = NUMBER_WORDS[word] ?? Number.parseInt(word, 10);
    if (Number.isFinite(count) && count > 0) return count;
  }
  return 1;
}
