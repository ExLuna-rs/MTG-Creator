import { describe, expect, it } from "vitest";
import { isDeckCard, type ScryfallCard, toCardRow } from "./scryfall";
import { fixtureCard, fixtureCards } from "./test-fixtures";

describe("isDeckCard", () => {
  const solRing = fixtureCard("Sol Ring");

  it("garde les cartes du jeu de test", () => {
    for (const card of fixtureCards().values()) {
      expect(isDeckCard(card), card.name).toBe(true);
    }
  });

  it("écarte jetons, emblèmes, plans et cartes Art Series", () => {
    for (const layout of ["token", "emblem", "planar", "art_series"]) {
      expect(isDeckCard({ ...solRing, layout })).toBe(false);
    }
    expect(
      isDeckCard({
        ...solRing,
        layout: "flip",
        type_line: "Token Enchantment — Aura Role",
      }),
    ).toBe(false);
  });

  it("écarte les cartes uniquement numériques non légales en Commander", () => {
    const alchemy: ScryfallCard = {
      ...solRing,
      games: ["arena"],
      legalities: { ...solRing.legalities, commander: "not_legal" },
    };
    expect(isDeckCard(alchemy)).toBe(false);
  });

  it("garde une carte légale même si l'édition retenue est numérique", () => {
    expect(isDeckCard({ ...solRing, games: ["mtgo"] })).toBe(true);
  });
});

describe("toCardRow", () => {
  it("transforme une carte simple", () => {
    const row = toCardRow(fixtureCard("Sol Ring"));
    expect(row).toMatchObject({
      name: "Sol Ring",
      searchName: "sol ring",
      manaCost: "{1}",
      manaValue: 1,
      types: ["Artifact"],
      colorIdentity: 0,
      commanderLegality: "legal",
      canBeCommander: false,
    });
    expect(row.faces).toHaveLength(1);
    expect(row.imageUris?.normal).toMatch(/^https:\/\/cards\.scryfall\.io\//);
  });

  it("garde les deux faces et leurs images pour une carte transformable", () => {
    const row = toCardRow(
      fixtureCard("Delver of Secrets // Insectile Aberration"),
    );
    expect(row.faces.map((face) => face.name)).toEqual([
      "Delver of Secrets",
      "Insectile Aberration",
    ]);
    expect(row.faces.every((face) => face.imageUris !== null)).toBe(true);
    expect(row.imageUris).toEqual(row.faces[0].imageUris);
    expect(row.manaCost).toBe("{U}");
  });

  it("garde l'image commune d'une carte scindée", () => {
    const row = toCardRow(fixtureCard("Fire // Ice"));
    expect(row.manaCost).toBe("{1}{R} // {1}{U}");
    expect(row.faces.map((face) => face.imageUris)).toEqual([null, null]);
    expect(row.imageUris).not.toBeNull();
    expect(row.searchName).toBe("fire ice");
  });

  it.each([
    ["Atraxa, Praetors' Voice", true],
    ["Esika, God of the Tree // The Prismatic Bridge", true],
    ["Parhelion II", true],
    ["Teferi, Temporal Archmage", true],
    ["Guild Artisan", false],
    ["Sol Ring", false],
  ])("« %s » peut être commandant : %s", (name, expected) => {
    expect(toCardRow(fixtureCard(name)).canBeCommander).toBe(expected);
  });

  it("encode l'identité couleur en masque de bits", () => {
    expect(
      toCardRow(fixtureCard("Atraxa, Praetors' Voice")).colorIdentity,
    ).toBe(1 | 2 | 4 | 16);
    expect(toCardRow(fixtureCard("The Ur-Dragon")).colorIdentity).toBe(31);
  });

  it("reprend la légalité en Commander et le statut Game Changer", () => {
    expect(toCardRow(fixtureCard("Mana Crypt")).commanderLegality).toBe(
      "banned",
    );
    expect(toCardRow(fixtureCard("Primeval Titan")).commanderLegality).toBe(
      "banned",
    );
    const gameChangers = [...fixtureCards().values()].filter(
      (card) => toCardRow(card).gameChanger,
    );
    expect(gameChangers.length).toBeGreaterThan(0);
  });

  it("convertit les prix en nombres", () => {
    const row = toCardRow(fixtureCard("Sol Ring"));
    expect(row.priceEur === null || typeof row.priceEur === "number").toBe(
      true,
    );
    expect(
      toCardRow({
        ...fixtureCard("Sol Ring"),
        prices: { usd: "1.50", eur: null },
      }),
    ).toMatchObject({ priceUsd: 1.5, priceEur: null });
  });
});
