import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScryfallPrinting } from "./printing";
import type { ScryfallCard } from "./scryfall";

let cache: Map<string, ScryfallCard> | undefined;

/** Cartes réelles du jeu de test (tests/fixtures/cards.jsonl), par nom. */
export function fixtureCards(): Map<string, ScryfallCard> {
  if (!cache) {
    const content = readFileSync(
      join(process.cwd(), "tests/fixtures/cards.jsonl"),
      "utf8",
    );
    const cards = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ScryfallCard);
    cache = new Map(cards.map((card) => [card.name, card]));
  }
  return cache;
}

export function fixtureCard(name: string): ScryfallCard {
  const card = fixtureCards().get(name);
  if (!card) throw new Error(`Carte absente du jeu de test : ${name}`);
  return card;
}

let printingCache: ScryfallPrinting[] | undefined;

/** Impressions réelles du jeu de test (tests/fixtures/printings.jsonl). */
export function fixturePrinting(
  name: string,
  set: string,
  collectorNumber: string,
): ScryfallPrinting {
  printingCache ??= readFileSync(
    join(process.cwd(), "tests/fixtures/printings.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ScryfallPrinting);
  const printing = printingCache.find(
    (item) =>
      item.name === name &&
      item.set === set &&
      item.collector_number === collectorNumber,
  );
  if (!printing) {
    throw new Error(`Impression absente : ${name} (${set}) ${collectorNumber}`);
  }
  return printing;
}
