import type { CardImageUris } from "./card";
import {
  EXCLUDED_LAYOUTS,
  getOracleId,
  parsePrice,
  type ScryfallCard,
} from "./scryfall";

/** Champs d'une impression Scryfall (fichier « Default Cards ») en plus de ceux d'une carte. */
export interface ScryfallPrinting extends ScryfallCard {
  digital?: boolean;
  oversized?: boolean;
  promo?: boolean;
  full_art?: boolean;
  textless?: boolean;
  variation?: boolean;
  border_color?: string;
  frame_effects?: string[];
  promo_types?: string[];
  finishes?: string[];
  cardmarket_id?: number;
  tcgplayer_id?: number;
}

/** Ligne de la table `printing`, prête à être insérée. */
export interface PrintingRow {
  id: string;
  oracleId: string;
  setCode: string;
  setName: string;
  setType: string;
  collectorNumber: string;
  rarity: string;
  releasedAt: string;
  special: boolean;
  finishes: string[];
  imageUris: CardImageUris | null;
  backImageUris: CardImageUris | null;
  artist: string | null;
  cardmarketId: number | null;
  tcgplayerId: number | null;
  priceEur: number | null;
  priceUsd: number | null;
  priceEurFoil: number | null;
  priceUsdFoil: number | null;
}

/** Ce que l'interface affiche d'une édition. */
export type Printing = Omit<PrintingRow, "oracleId" | "setType" | "finishes">;

/** Extensions sans cartes jouables : jetons, cartes géantes, souvenirs… */
const EXCLUDED_SET_TYPES = new Set(["token", "minigame", "vanguard"]);

/**
 * Indique si l'impression est une carte papier qu'on peut mettre dans un
 * deck : pas de version Arena ou MTGO, de jeton, de carte d'illustration ni
 * de carte géante.
 */
export function isPaperPrinting(card: ScryfallPrinting): boolean {
  if (!getOracleId(card)) return false;
  if (card.digital || card.oversized) return false;
  if (!card.games.includes("paper")) return false;
  if (EXCLUDED_LAYOUTS.has(card.layout)) return false;
  if (card.set_type && EXCLUDED_SET_TYPES.has(card.set_type)) return false;
  const typeLine = card.type_line ?? card.card_faces?.[0]?.type_line ?? "";
  return !/^Token\b/.test(typeLine);
}

/** Cadres et traitements qui font d'une impression une version spéciale. */
const SPECIAL_FRAMES = new Set([
  "showcase",
  "extendedart",
  "inverted",
  "etched",
]);
const SPECIAL_SET_TYPES = new Set(["promo", "memorabilia", "box", "funny"]);

/**
 * Version spéciale : promo, illustration pleine ou étendue, sans bordure,
 * vitrine, Secret Lair… Les autres sont les impressions « normales ».
 */
export function isSpecialPrinting(card: ScryfallPrinting): boolean {
  return Boolean(
    card.promo ||
      card.full_art ||
      card.textless ||
      card.variation ||
      card.border_color === "borderless" ||
      card.border_color === "gold" ||
      card.frame_effects?.some((effect) => SPECIAL_FRAMES.has(effect)) ||
      (card.set_type && SPECIAL_SET_TYPES.has(card.set_type)) ||
      card.set === "sld",
  );
}

/** Transforme une impression Scryfall en ligne de la table `printing`. */
export function toPrintingRow(card: ScryfallPrinting): PrintingRow {
  const oracleId = getOracleId(card);
  if (!oracleId) throw new Error(`Impression sans oracle_id : ${card.name}`);
  const faces = card.card_faces ?? [];
  return {
    id: card.id,
    oracleId,
    setCode: card.set,
    setName: card.set_name,
    setType: card.set_type ?? "",
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    releasedAt: card.released_at,
    special: isSpecialPrinting(card),
    finishes: card.finishes ?? ["nonfoil"],
    imageUris: card.image_uris ?? faces[0]?.image_uris ?? null,
    backImageUris: card.image_uris ? null : (faces[1]?.image_uris ?? null),
    artist: card.artist ?? faces[0]?.artist ?? null,
    cardmarketId: card.cardmarket_id ?? null,
    tcgplayerId: card.tcgplayer_id ?? null,
    priceEur: parsePrice(card.prices?.eur),
    priceUsd: parsePrice(card.prices?.usd),
    priceEurFoil: parsePrice(card.prices?.eur_foil),
    priceUsdFoil: parsePrice(card.prices?.usd_foil),
  };
}

/** Prix d'une édition dans la devise affichée : non brillante, sinon brillante. */
export function printingPrice(
  printing: Pick<
    Printing,
    "priceEur" | "priceUsd" | "priceEurFoil" | "priceUsdFoil"
  >,
  currency: "EUR" | "USD",
): number | null {
  return currency === "EUR"
    ? (printing.priceEur ?? printing.priceEurFoil)
    : (printing.priceUsd ?? printing.priceUsdFoil);
}
