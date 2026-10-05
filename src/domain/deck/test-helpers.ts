import { toCardRow } from "../cards/scryfall";
import { fixtureCard } from "../cards/test-fixtures";
import type { DeckCard, DeckCardData, DeckZone } from "./deck";

/** Données d'une carte réelle du jeu de test, telles que l'éditeur les reçoit. */
export function cardData(name: string): DeckCardData {
  const row = toCardRow(fixtureCard(name));
  return {
    oracleId: row.oracleId,
    name: row.name,
    manaCost: row.manaCost,
    manaValue: row.manaValue,
    typeLine: row.typeLine,
    oracleText: row.oracleText,
    supertypes: row.supertypes,
    types: row.types,
    subtypes: row.subtypes,
    colorIdentity: row.colorIdentity,
    producedMana: row.producedMana,
    commanderLegality: row.commanderLegality,
    canBeCommander: row.canBeCommander,
    gameChanger: row.gameChanger,
    edhrecRank: row.edhrecRank,
    priceEur: row.priceEur,
    priceUsd: row.priceUsd,
    imageUris: row.imageUris,
  };
}

/** Ligne de deck pour une carte du jeu de test. */
export function deckCard(
  name: string,
  {
    zone = "main",
    quantity = 1,
    categories = [],
  }: {
    zone?: DeckZone;
    quantity?: number;
    categories?: string[];
  } = {},
): DeckCard {
  const card = cardData(name);
  return { oracleId: card.oracleId, zone, quantity, categories, card };
}
