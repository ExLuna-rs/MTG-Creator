/** Liens vers les images d'une carte sur le CDN de Scryfall. */
export interface CardImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

/** Une face de carte (une seule pour les cartes classiques). */
export interface CardFace {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  imageUris: CardImageUris | null;
}

/** Légalité d'une carte dans un format (valeurs de Scryfall). */
export type Legality = (typeof LEGALITIES)[number];

/** Raretés de Scryfall, de la plus courante à la plus rare. */
export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "mythic",
  "special",
  "bonus",
] as const;

export type Rarity = (typeof RARITIES)[number];

/** Formats dont la légalité est affichée sur la fiche d'une carte. */
export const DISPLAYED_FORMATS = [
  "commander",
  "paupercommander",
  "oathbreaker",
  "brawl",
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "historic",
  "timeless",
] as const;

export const LEGALITIES = [
  "legal",
  "not_legal",
  "banned",
  "restricted",
] as const;

export function isLegality(value: string): value is Legality {
  return (LEGALITIES as readonly string[]).includes(value);
}
