import { describe, expect, it } from "vitest";
import type { DeckCardData, DeckEntry } from "../deck/deck";
import { MAX_DECK_ENTRIES } from "../deck/schema";
import { cardData } from "../deck/test-helpers";
import { parseDeckList } from "./deck-list";
import { importEntries, mergeImport, uniqueNames } from "./import";

const atraxa = cardData("Atraxa, Praetors' Voice");
const solRing = cardData("Sol Ring");
const island = cardData("Island");
const bolt = cardData("Lightning Bolt");
const known = [atraxa, solRing, island, bolt];
const byId = Object.fromEntries(known.map((card) => [card.oracleId, card]));

/** Reconnaissance simplifiée : nom exact, comme le serveur. */
const resolve = ({ name }: { name: string }): DeckCardData | null =>
  known.find((card) => card.name.toLowerCase() === name.toLowerCase()) ?? null;

const entry = (
  card: DeckCardData,
  zone: DeckEntry["zone"],
  quantity = 1,
  categories: string[] = [],
): DeckEntry => ({ oracleId: card.oracleId, zone, quantity, categories });

const commanderOnly = [entry(atraxa, "commander")];

describe("import d'une liste", () => {
  it("envoie chaque nom une seule fois au serveur", () => {
    const { cards } = parseDeckList("1 Sol Ring\n1 sol ring\n1 Island");
    expect(uniqueNames(cards)).toEqual(["Sol Ring", "Island"]);
  });

  it("regroupe les lignes d'une même carte et ignore les cartes inconnues", () => {
    const { cards } = parseDeckList(
      "10 Island\n5 Island [Lands]\n1 Sol Ring\n1 Inconnue\n1 Lightning Bolt\nSideboard\n1 Lightning Bolt",
    );
    expect(importEntries(cards, resolve)).toEqual([
      entry(island, "main", 15, []),
      entry(solRing, "main"),
      entry(bolt, "main"),
      entry(bolt, "maybe"),
    ]);
  });

  it("ajoute au deck en respectant le singleton", () => {
    const current = [...commanderOnly, entry(solRing, "main", 1, ["Ramp"])];
    const merged = mergeImport(
      current,
      [
        entry(solRing, "main", 2, ["Mana"]),
        entry(island, "main", 30),
        entry(bolt, "maybe"),
      ],
      byId,
      { replace: false },
    );
    expect(merged).toEqual([
      entry(atraxa, "commander"),
      entry(solRing, "main", 1, ["Ramp", "Mana"]),
      entry(island, "main", 30),
      entry(bolt, "maybe"),
    ]);
  });

  it("n'ajoute pas au deck une carte déjà commandant", () => {
    const merged = mergeImport(
      commanderOnly,
      [entry(atraxa, "main"), entry(solRing, "main")],
      byId,
      { replace: false },
    );
    expect(merged).toEqual([
      entry(atraxa, "commander"),
      entry(solRing, "main"),
    ]);
  });

  it("remplace le deck et garde les commandants si la liste n'en a pas", () => {
    const current = [...commanderOnly, entry(bolt, "main")];
    expect(
      mergeImport(current, [entry(solRing, "main")], byId, { replace: true }),
    ).toEqual([entry(atraxa, "commander"), entry(solRing, "main")]);
  });

  it("remplace aussi les commandants si la liste en indique", () => {
    const merged = mergeImport(
      [...commanderOnly, entry(bolt, "main")],
      [entry(solRing, "commander"), entry(island, "main", 5)],
      byId,
      { replace: true },
    );
    expect(merged).toEqual([
      entry(solRing, "commander"),
      entry(island, "main", 5),
    ]);
  });

  it("ne dépasse pas le nombre maximal de lignes d'un deck", () => {
    const many = Array.from({ length: MAX_DECK_ENTRIES + 5 }, (_, index) => ({
      oracleId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      zone: "main" as const,
      quantity: 1,
      categories: [],
    }));
    expect(
      mergeImport(commanderOnly, many, byId, { replace: false }),
    ).toHaveLength(MAX_DECK_ENTRIES);
  });
});
