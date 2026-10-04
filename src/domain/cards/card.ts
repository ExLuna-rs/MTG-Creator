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
export type Legality = "legal" | "not_legal" | "banned" | "restricted";

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
