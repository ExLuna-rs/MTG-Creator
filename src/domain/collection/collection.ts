import type { CardImageUris } from "@/domain/cards/card";
import { normalizeCardName } from "@/domain/cards/normalize";

/** Une carte de la collection et son nombre d'exemplaires. */
export interface CollectionEntry {
  oracleId: string;
  name: string;
  typeLine: string;
  types: string[];
  manaValue: number;
  colorIdentity: number;
  rarity: string;
  priceEur: number | null;
  priceUsd: number | null;
  imageUris: CardImageUris | null;
  quantity: number;
  /** Date du premier ajout à la collection. */
  addedAt: Date;
}

/** Tris de la page de la collection. */
export const COLLECTION_SORTS = [
  "name",
  "color",
  "type",
  "manaValue",
  "rarity",
  "price",
  "quantity",
  "recent",
] as const;

export type CollectionSort = (typeof COLLECTION_SORTS)[number];

/** Ordre des types : le premier type d'une carte dans cette liste la classe. */
const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
];

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"];

function bitCount(mask: number): number {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) count++;
  return count;
}

/**
 * Rang d'une identité couleur : blanc, bleu, noir, rouge, vert, puis les
 * multicolores (deux couleurs, trois…), et les incolores en dernier.
 */
function colorRank(mask: number): number {
  if (mask === 0) return 1000;
  return bitCount(mask) * 100 + mask;
}

function typeRank(types: readonly string[]): number {
  const ranks = types
    .map((type) => TYPE_ORDER.indexOf(type))
    .filter((rank) => rank >= 0);
  return ranks.length > 0 ? Math.min(...ranks) : TYPE_ORDER.length;
}

function rarityRank(rarity: string): number {
  const rank = RARITY_ORDER.indexOf(rarity);
  return rank >= 0 ? rank : RARITY_ORDER.length;
}

/**
 * Cartes dont le nom contient la recherche (sans tenir compte des accents,
 * de la casse ni de la ponctuation), triées ; à égalité, par nom.
 */
export function selectCollection(
  entries: readonly CollectionEntry[],
  {
    query = "",
    sort = "name",
    currency = "EUR",
  }: { query?: string; sort?: CollectionSort; currency?: "EUR" | "USD" },
): CollectionEntry[] {
  const wanted = normalizeCardName(query);
  const price = (entry: CollectionEntry) =>
    (currency === "EUR" ? entry.priceEur : entry.priceUsd) ?? -1;
  const keys: Record<
    CollectionSort,
    (a: CollectionEntry, b: CollectionEntry) => number
  > = {
    name: () => 0,
    color: (a, b) => colorRank(a.colorIdentity) - colorRank(b.colorIdentity),
    type: (a, b) => typeRank(a.types) - typeRank(b.types),
    manaValue: (a, b) => a.manaValue - b.manaValue,
    rarity: (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity),
    price: (a, b) => price(b) - price(a),
    quantity: (a, b) => b.quantity - a.quantity,
    recent: (a, b) => b.addedAt.getTime() - a.addedAt.getTime(),
  };
  return entries
    .filter(
      (entry) => !wanted || normalizeCardName(entry.name).includes(wanted),
    )
    .sort((a, b) => keys[sort](a, b) || a.name.localeCompare(b.name, "en"));
}
