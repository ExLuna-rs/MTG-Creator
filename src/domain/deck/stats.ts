import { COLORS, type Color } from "../cards/colors";
import { tokenizeSymbols } from "../cards/symbols";
import {
  countCards,
  type DeckCard,
  PRIMARY_TYPES,
  type PrimaryType,
  playedCards,
  primaryType,
} from "./deck";

/** Colonnes de la courbe de mana : 0, 1, … 6, puis « 7 et plus ». */
export const MANA_CURVE_MAX = 7;

export interface DeckStats {
  /** Cartes du deck, commandant(s) compris. */
  cardCount: number;
  landCount: number;
  /** Cartes hors terrains par valeur de mana (index 7 : 7 et plus). */
  manaCurve: number[];
  /** Valeur de mana moyenne des cartes hors terrains (0 s'il n'y en a pas). */
  averageManaValue: number;
  typeCounts: Record<PrimaryType, number>;
  /** Symboles de mana de chaque couleur dans les coûts des cartes. */
  colorPips: Record<Color, number>;
  /** Cartes qui produisent du mana de chaque couleur (terrains et autres). */
  colorSources: Record<Color, number>;
  /** Prix total ; `missing` compte les cartes sans prix connu. */
  price: {
    eur: number;
    usd: number;
    missingEur: number;
    missingUsd: number;
  };
}

function emptyColorRecord(): Record<Color, number> {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

/** Couleurs d'un symbole de coût : {W/U} compte pour W et U, {2/B} pour B. */
function symbolColors(symbol: string): Color[] {
  const inner = symbol.slice(1, -1).toUpperCase();
  return COLORS.filter((color) => inner.split("/").includes(color));
}

/** Nombre de symboles de chaque couleur dans un coût de mana. */
export function countPips(manaCost: string | null): Record<Color, number> {
  const pips = emptyColorRecord();
  for (const token of tokenizeSymbols(manaCost ?? "")) {
    if (token.kind !== "symbol") continue;
    for (const color of symbolColors(token.symbol)) pips[color] += 1;
  }
  return pips;
}

/** Arrondi au centime, pour éviter les 12.300000000000001. */
const roundCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Statistiques d'un deck : courbe de mana, types, couleurs demandées et
 * sources de mana, terrains, prix. Les cartes à considérer sont ignorées.
 */
export function computeDeckStats(deck: readonly DeckCard[]): DeckStats {
  const played = playedCards(deck);
  const manaCurve = Array.from({ length: MANA_CURVE_MAX + 1 }, () => 0);
  const typeCounts = Object.fromEntries(
    PRIMARY_TYPES.map((type) => [type, 0]),
  ) as Record<PrimaryType, number>;
  const colorPips = emptyColorRecord();
  const colorSources = emptyColorRecord();
  const price = { eur: 0, usd: 0, missingEur: 0, missingUsd: 0 };
  let landCount = 0;
  let spellCount = 0;
  let manaValueTotal = 0;

  for (const { card, quantity } of played) {
    const type = primaryType(card);
    typeCounts[type] += quantity;

    if (type === "Land") {
      landCount += quantity;
    } else {
      const column = Math.min(Math.floor(card.manaValue), MANA_CURVE_MAX);
      manaCurve[column] += quantity;
      spellCount += quantity;
      manaValueTotal += card.manaValue * quantity;
    }

    const pips = countPips(card.manaCost);
    for (const color of COLORS) {
      colorPips[color] += pips[color] * quantity;
      if (card.producedMana.includes(color)) colorSources[color] += quantity;
    }

    if (card.priceEur === null) price.missingEur += quantity;
    else price.eur += card.priceEur * quantity;
    if (card.priceUsd === null) price.missingUsd += quantity;
    else price.usd += card.priceUsd * quantity;
  }

  return {
    cardCount: countCards(played),
    landCount,
    manaCurve,
    averageManaValue:
      spellCount === 0 ? 0 : roundCents(manaValueTotal / spellCount),
    typeCounts,
    colorPips,
    colorSources,
    price: {
      ...price,
      eur: roundCents(price.eur),
      usd: roundCents(price.usd),
    },
  };
}
