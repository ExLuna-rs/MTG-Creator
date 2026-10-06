import { describe, expect, it } from "vitest";
import { type CollectionEntry, selectCollection } from "./collection";

function entry(
  name: string,
  fields: Partial<CollectionEntry> = {},
): CollectionEntry {
  return {
    oracleId: name,
    name,
    typeLine: "",
    types: [],
    manaValue: 0,
    colorIdentity: 0,
    rarity: "common",
    priceEur: null,
    priceUsd: null,
    imageUris: null,
    quantity: 1,
    addedAt: new Date("2026-10-01"),
    ...fields,
  };
}

const names = (entries: CollectionEntry[]) => entries.map((e) => e.name);

describe("sélection dans la collection", () => {
  const entries = [
    entry("Sol Ring", {
      types: ["Artifact"],
      manaValue: 1,
      rarity: "uncommon",
      priceEur: 1.5,
      quantity: 3,
    }),
    entry("Lightning Bolt", {
      types: ["Instant"],
      manaValue: 1,
      colorIdentity: 8,
      priceEur: 2,
    }),
    entry("Counterspell", {
      types: ["Instant"],
      manaValue: 2,
      colorIdentity: 2,
      rarity: "common",
      priceEur: 1,
    }),
    entry("Atraxa, Praetors' Voice", {
      types: ["Creature"],
      manaValue: 4,
      colorIdentity: 1 | 2 | 4 | 16,
      rarity: "mythic",
      priceEur: 20,
      addedAt: new Date("2026-10-05"),
    }),
    entry("Swords to Plowshares", {
      types: ["Instant"],
      manaValue: 1,
      colorIdentity: 1,
      rarity: "uncommon",
    }),
  ];

  it("trie par nom par défaut", () => {
    expect(names(selectCollection(entries, {}))).toEqual([
      "Atraxa, Praetors' Voice",
      "Counterspell",
      "Lightning Bolt",
      "Sol Ring",
      "Swords to Plowshares",
    ]);
  });

  it("filtre par nom, sans accents ni casse", () => {
    expect(names(selectCollection(entries, { query: "praetor" }))).toEqual([
      "Atraxa, Praetors' Voice",
    ]);
    expect(names(selectCollection(entries, { query: "BOLT" }))).toEqual([
      "Lightning Bolt",
    ]);
  });

  it("trie par couleur : WUBRG, multicolores, puis incolores", () => {
    expect(names(selectCollection(entries, { sort: "color" }))).toEqual([
      "Swords to Plowshares",
      "Counterspell",
      "Lightning Bolt",
      "Atraxa, Praetors' Voice",
      "Sol Ring",
    ]);
  });

  it("trie par type, rareté, prix, quantité et date d'ajout", () => {
    expect(names(selectCollection(entries, { sort: "type" }))[0]).toBe(
      "Atraxa, Praetors' Voice",
    );
    expect(names(selectCollection(entries, { sort: "type" })).at(-1)).toBe(
      "Sol Ring",
    );
    expect(
      names(selectCollection(entries, { sort: "rarity" })).slice(0, 3),
    ).toEqual(["Atraxa, Praetors' Voice", "Sol Ring", "Swords to Plowshares"]);
    expect(names(selectCollection(entries, { sort: "price" }))).toEqual([
      "Atraxa, Praetors' Voice",
      "Lightning Bolt",
      "Sol Ring",
      "Counterspell",
      "Swords to Plowshares",
    ]);
    expect(names(selectCollection(entries, { sort: "quantity" }))[0]).toBe(
      "Sol Ring",
    );
    expect(names(selectCollection(entries, { sort: "recent" }))[0]).toBe(
      "Atraxa, Praetors' Voice",
    );
    expect(names(selectCollection(entries, { sort: "manaValue" })).at(-1)).toBe(
      "Atraxa, Praetors' Voice",
    );
  });
});
