import type { CardFace, CardImageUris } from "./card";
import { colorsToMask } from "./colors";
import { normalizeCardName } from "./normalize";
import { parseTypeLine } from "./type-line";

/** Sous-ensemble d'un objet carte de Scryfall utilisé par l'import. */
export interface ScryfallCardFace {
  name: string;
  oracle_id?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string[];
  artist?: string;
  image_uris?: CardImageUris;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  layout: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string[];
  color_identity: string[];
  keywords?: string[];
  legalities: Record<string, string>;
  games: string[];
  game_changer?: boolean;
  edhrec_rank?: number;
  produced_mana?: string[];
  card_faces?: ScryfallCardFace[];
  image_uris?: CardImageUris;
  prices?: { usd?: string | null; eur?: string | null };
  rarity: string;
  set: string;
  set_name: string;
  set_type?: string;
  collector_number: string;
  released_at: string;
  artist?: string;
  scryfall_uri: string;
}

/** Ligne de la table `card`, prête à être insérée. */
export interface CardRow {
  oracleId: string;
  scryfallId: string;
  name: string;
  searchName: string;
  layout: string;
  manaCost: string | null;
  manaValue: number;
  typeLine: string;
  oracleText: string | null;
  colors: string[];
  colorIdentity: number;
  keywords: string[];
  supertypes: string[];
  types: string[];
  subtypes: string[];
  faces: CardFace[];
  imageUris: CardImageUris | null;
  legalities: Record<string, string>;
  commanderLegality: string;
  canBeCommander: boolean;
  gameChanger: boolean;
  edhrecRank: number | null;
  producedMana: string[];
  rarity: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  releasedAt: string;
  artist: string | null;
  priceUsd: number | null;
  priceEur: number | null;
  scryfallUri: string;
}

/** Mises en page qui ne sont pas des cartes de deck (jetons, plans, etc.). */
const EXCLUDED_LAYOUTS = new Set([
  "art_series",
  "double_faced_token",
  "emblem",
  "front_card",
  "planar",
  "scheme",
  "token",
  "vanguard",
]);

/**
 * Indique si l'objet Scryfall est une carte qu'on peut mettre dans un deck.
 * Écarte jetons, emblèmes, plans, donjons, cartes « Art Series » et cartes
 * uniquement numériques non légales en Commander (Alchemy, par exemple).
 * Note : `games` ne décrit que l'édition retenue par Scryfall, d'où la
 * condition sur la légalité plutôt que sur `games` seul.
 */
export function isDeckCard(card: ScryfallCard): boolean {
  if (!getOracleId(card)) return false;
  if (EXCLUDED_LAYOUTS.has(card.layout)) return false;
  const typeLine = card.type_line ?? card.card_faces?.[0]?.type_line ?? "";
  if (/^Token\b/.test(typeLine) || /\bDungeon\b/.test(typeLine)) return false;
  const commander = card.legalities.commander ?? "not_legal";
  if (!card.games.includes("paper") && commander === "not_legal") return false;
  return true;
}

function getOracleId(card: ScryfallCard): string | undefined {
  return card.oracle_id ?? card.card_faces?.[0]?.oracle_id;
}

function toFace(face: ScryfallCardFace | ScryfallCard): CardFace {
  return {
    name: face.name,
    manaCost: face.mana_cost || null,
    typeLine: face.type_line ?? null,
    oracleText: face.oracle_text ?? null,
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    defense: face.defense ?? null,
    imageUris: face.image_uris ?? null,
  };
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const price = Number.parseFloat(value);
  return Number.isFinite(price) ? price : null;
}

/**
 * Une carte peut être commandant si sa face avant est une créature
 * légendaire, un Véhicule ou un vaisseau (Spacecraft) légendaire possédant une
 * force et une endurance (règle en vigueur depuis Edge of Eternities), ou si
 * son texte l'autorise (« can be your commander »).
 */
export function canBeCommander(front: CardFace, oracleText: string): boolean {
  const typeLine = front.typeLine ?? "";
  if (/can be your commander/i.test(oracleText)) return true;
  if (!/\bLegendary\b/.test(typeLine)) return false;
  if (/\bCreature\b/.test(typeLine)) return true;
  const hasPowerToughness = front.power !== null && front.toughness !== null;
  return /\b(Vehicle|Spacecraft)\b/.test(typeLine) && hasPowerToughness;
}

/** Transforme un objet carte de Scryfall en ligne de la table `card`. */
export function toCardRow(card: ScryfallCard): CardRow {
  const oracleId = getOracleId(card);
  if (!oracleId) throw new Error(`Carte sans oracle_id : ${card.name}`);

  const faces = card.card_faces?.length
    ? card.card_faces.map(toFace)
    : [toFace(card)];
  const front = faces[0];

  const typeLine =
    card.type_line ??
    faces
      .map((face) => face.typeLine)
      .filter(Boolean)
      .join(" // ");
  const oracleText =
    card.oracle_text ??
    (faces
      .map((face) => face.oracleText)
      .filter(Boolean)
      .join("\n\n") ||
      null);
  const manaCost =
    card.mana_cost ||
    faces
      .map((face) => face.manaCost)
      .filter(Boolean)
      .join(" // ") ||
    null;
  const colors = card.colors ?? [
    ...new Set(card.card_faces?.flatMap((face) => face.colors ?? []) ?? []),
  ];
  const { supertypes, types, subtypes } = parseTypeLine(typeLine);

  return {
    oracleId,
    scryfallId: card.id,
    name: card.name,
    searchName: normalizeCardName(card.name),
    layout: card.layout,
    manaCost,
    manaValue: card.cmc ?? 0,
    typeLine,
    oracleText,
    colors,
    colorIdentity: colorsToMask(card.color_identity),
    keywords: card.keywords ?? [],
    supertypes,
    types,
    subtypes,
    faces,
    imageUris: card.image_uris ?? front.imageUris,
    legalities: card.legalities,
    commanderLegality: card.legalities.commander ?? "not_legal",
    canBeCommander: canBeCommander(front, front.oracleText ?? ""),
    gameChanger: card.game_changer ?? false,
    edhrecRank: card.edhrec_rank ?? null,
    producedMana: card.produced_mana ?? [],
    rarity: card.rarity,
    setCode: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    releasedAt: card.released_at,
    artist: card.artist ?? card.card_faces?.[0]?.artist ?? null,
    priceUsd: parsePrice(card.prices?.usd),
    priceEur: parsePrice(card.prices?.eur),
    scryfallUri: card.scryfall_uri,
  };
}
