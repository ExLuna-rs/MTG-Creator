import { describe, expect, it } from "vitest";
import { computeDeckStats, countPips } from "./stats";
import { deckCard } from "./test-helpers";

describe("symboles de mana d'un coût", () => {
  it("compte chaque couleur, hybrides et phyrexians compris", () => {
    expect(countPips("{2}{U}{U}")).toMatchObject({ U: 2, W: 0 });
    expect(countPips("{1}{G/W}{G/W}")).toMatchObject({ G: 2, W: 2 });
    expect(countPips("{1}{B/P}{B/P}")).toMatchObject({ B: 2 });
    expect(countPips("{1}{R} // {1}{U}")).toMatchObject({ R: 1, U: 1 });
    expect(countPips(null)).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });
});

describe("statistiques d'un deck", () => {
  const deck = [
    deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
    deckCard("Sol Ring"),
    deckCard("Counterspell"),
    deckCard("Kitchen Finks"),
    deckCard("Birds of Paradise"),
    deckCard("Command Tower"),
    deckCard("Island", { quantity: 10 }),
    deckCard("Lightning Bolt", { zone: "maybe" }),
  ];
  const stats = computeDeckStats(deck);

  it("compte les cartes et les terrains, sans les cartes à considérer", () => {
    expect(stats.cardCount).toBe(16);
    expect(stats.landCount).toBe(11);
  });

  it("dessine la courbe de mana des cartes hors terrains", () => {
    // Sol Ring et Birds (1), Counterspell (2), Kitchen Finks (3), Atraxa (4).
    expect(stats.manaCurve).toEqual([0, 2, 1, 1, 1, 0, 0, 0]);
    expect(stats.averageManaValue).toBe(2.2);
  });

  it("répartit les cartes par type principal", () => {
    expect(stats.typeCounts).toMatchObject({
      Creature: 3,
      Artifact: 1,
      Instant: 1,
      Land: 11,
      Sorcery: 0,
    });
  });

  it("compare les couleurs demandées aux sources de mana", () => {
    expect(stats.colorPips).toEqual({ W: 3, U: 3, B: 1, R: 0, G: 4 });
    // Island ×10, Command Tower et Birds of Paradise produisent du bleu.
    expect(stats.colorSources.U).toBe(12);
    expect(stats.colorSources.R).toBe(2);
  });

  it("additionne les prix et compte les cartes sans prix", () => {
    expect(stats.price.missingEur).toBe(10);
    expect(stats.price.eur).toBeGreaterThan(0);
    expect(Number.isInteger(Math.round(stats.price.eur * 100))).toBe(true);
  });

  it("met les cartes hors terrains à 7 et plus dans la dernière colonne", () => {
    const big = computeDeckStats([deckCard("Kozilek, the Great Distortion")]);
    expect(big.manaCurve[7]).toBe(1);
  });

  it("renvoie des statistiques vides pour un deck vide", () => {
    const empty = computeDeckStats([]);
    expect(empty.cardCount).toBe(0);
    expect(empty.averageManaValue).toBe(0);
    expect(empty.price.eur).toBe(0);
  });
});
