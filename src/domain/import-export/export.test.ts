import { describe, expect, it } from "vitest";
import { deckCard } from "../deck/test-helpers";
import { parseDeckList } from "./deck-list";
import { exportCollection, exportDeck } from "./export";

const deck = [
  deckCard("Sol Ring", { categories: ["Ramp"] }),
  deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
  deckCard("Island", { quantity: 6 }),
  deckCard("Fire // Ice"),
  deckCard("Rhystic Study", { zone: "maybe", categories: ["Draw"] }),
];
const options = { includeMaybe: false, skipBasicLands: false };

describe("exportDeck", () => {
  it("écrit les sections de MTG Arena et Moxfield, triées par nom", () => {
    expect(exportDeck(deck, "arena", { ...options, includeMaybe: true })).toBe(
      [
        "Commander",
        "1 Atraxa, Praetors' Voice",
        "",
        "Deck",
        "1 Fire // Ice",
        "6 Island",
        "1 Sol Ring",
        "",
        "Sideboard",
        "1 Rhystic Study",
      ].join("\n"),
    );
    expect(exportDeck(deck, "arena", options)).not.toContain("Sideboard");
  });

  it("écrit les catégories d'Archidekt et y range commandant et maybeboard", () => {
    expect(
      exportDeck(deck, "archidekt", { ...options, includeMaybe: true }),
    ).toBe(
      [
        "1x Atraxa, Praetors' Voice [Commander{top}]",
        "1x Fire // Ice",
        "6x Island",
        "1x Sol Ring [Ramp]",
        "1x Rhystic Study [Maybeboard{noDeck}{noPrice}]",
      ].join("\n"),
    );
  });

  it("écrit un texte simple, commandant en premier", () => {
    expect(exportDeck(deck, "plain", options)).toBe(
      "1 Atraxa, Praetors' Voice\n1 Fire // Ice\n6 Island\n1 Sol Ring",
    );
  });

  it("prépare une liste d'achat Cardmarket, sans terrains de base si demandé", () => {
    const withDouble = [...deck, deckCard("Sol Ring", { zone: "maybe" })];
    expect(
      exportDeck(withDouble, "cardmarket", {
        includeMaybe: true,
        skipBasicLands: true,
      }),
    ).toBe(
      "1 Atraxa, Praetors' Voice\n1 Fire // Ice\n1 Rhystic Study\n2 Sol Ring",
    );
  });

  it("se relit à l'identique avec l'import", () => {
    for (const format of ["arena", "archidekt", "plain"] as const) {
      const lines = parseDeckList(
        exportDeck(deck, format, { ...options, includeMaybe: true }),
      ).cards.map(({ quantity, name }) => `${quantity} ${name}`);
      expect(lines.sort(), format).toEqual(
        deck.map((entry) => `${entry.quantity} ${entry.card.name}`).sort(),
      );
    }
    const archidekt = parseDeckList(
      exportDeck(deck, "archidekt", { ...options, includeMaybe: true }),
    ).cards;
    expect(
      archidekt.find((line) => line.name === "Sol Ring")?.categories,
    ).toEqual(["Ramp"]);
    expect(archidekt.find((line) => line.name === "Rhystic Study")?.zone).toBe(
      "maybe",
    );
    expect(archidekt[0].zone).toBe("commander");
  });
});

describe("exportCollection", () => {
  const entries = [
    { name: "Sol Ring", quantity: 3 },
    { name: 'Kongming, "Sleeping Dragon"', quantity: 1 },
    { name: "Counterspell", quantity: 0 },
  ];

  it("écrit un texte trié par nom", () => {
    expect(exportCollection(entries, "text")).toBe(
      '1 Kongming, "Sleeping Dragon"\n3 Sol Ring',
    );
  });

  it("écrit un CSV aux champs protégés", () => {
    expect(exportCollection(entries, "csv")).toBe(
      '"Count","Name"\n"1","Kongming, ""Sleeping Dragon"""\n"3","Sol Ring"',
    );
  });
});
