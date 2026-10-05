import type { CardImageUris } from "../cards/card";
import { parseTypeLine } from "../cards/type-line";

/**
 * Zones d'un deck : le ou les commandants, le deck lui-même et les cartes
 * « à considérer » (maybeboard), qui ne comptent pas dans les règles.
 */
export const DECK_ZONES = ["commander", "main", "maybe"] as const;

export type DeckZone = (typeof DECK_ZONES)[number];

/** Formats de deck ; seul Commander existe pour l'instant. */
export const DECK_FORMATS = ["commander"] as const;

export type DeckFormat = (typeof DECK_FORMATS)[number];

/** Taille d'un deck Commander, commandant(s) compris. */
export const COMMANDER_DECK_SIZE = 100;

/** Données d'une carte utiles à l'éditeur, aux règles et aux statistiques. */
export interface DeckCardData {
  oracleId: string;
  name: string;
  manaCost: string | null;
  manaValue: number;
  typeLine: string;
  oracleText: string | null;
  supertypes: string[];
  types: string[];
  subtypes: string[];
  colorIdentity: number;
  producedMana: string[];
  commanderLegality: string;
  canBeCommander: boolean;
  gameChanger: boolean;
  edhrecRank: number | null;
  priceEur: number | null;
  priceUsd: number | null;
  imageUris: CardImageUris | null;
}

/** Une ligne du deck : une carte, sa zone, sa quantité et ses catégories. */
export interface DeckEntry {
  oracleId: string;
  zone: DeckZone;
  quantity: number;
  categories: string[];
}

/** Ligne du deck accompagnée des données de sa carte. */
export interface DeckCard extends DeckEntry {
  card: DeckCardData;
}

/** Lignes qui comptent pour les règles : commandant(s) et deck. */
export function playedCards<T extends DeckEntry>(entries: readonly T[]): T[] {
  return entries.filter((entry) => entry.zone !== "maybe");
}

/** Nombre total de cartes (quantités comprises) des lignes données. */
export function countCards(entries: readonly DeckEntry[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

/** Nom de la face avant (« Fire // Ice » donne « Fire »). */
export function frontName(name: string): string {
  return name.split(" // ")[0];
}

/** Ligne de type de la face avant. */
export function frontTypeLine(card: Pick<DeckCardData, "typeLine">): string {
  return card.typeLine.split(" // ")[0];
}

/**
 * Types principaux, dans l'ordre où le deck les regroupe. Une carte va dans
 * le premier groupe qui correspond à sa face avant : une créature-artefact
 * est une créature, un enchantement-terrain est un terrain.
 */
export const PRIMARY_TYPES = [
  "Creature",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
  "Other",
] as const;

export type PrimaryType = (typeof PRIMARY_TYPES)[number];

const TYPE_PRECEDENCE: PrimaryType[] = [
  "Creature",
  "Land",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
];

export function primaryType(card: Pick<DeckCardData, "typeLine">): PrimaryType {
  const { types } = parseTypeLine(frontTypeLine(card));
  return TYPE_PRECEDENCE.find((type) => types.includes(type)) ?? "Other";
}

export function isLand(card: Pick<DeckCardData, "typeLine">): boolean {
  return primaryType(card) === "Land";
}
