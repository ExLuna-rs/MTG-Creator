import { describe, expect, it } from "vitest";
import { primaryType } from "./deck";
import { groupDeck } from "./groups";
import { cardData, deckCard } from "./test-helpers";

describe("type principal d'une carte", () => {
  it("se fie à la face avant et à l'ordre de priorité", () => {
    expect(primaryType(cardData("Solemn Simulacrum"))).toBe("Creature");
    expect(primaryType(cardData("Urza's Saga"))).toBe("Land");
    expect(primaryType(cardData("Bonecrusher Giant // Stomp"))).toBe(
      "Creature",
    );
    expect(
      primaryType(cardData("Invasion of Ikoria // Zilortha, Apex of Ikoria")),
    ).toBe("Battle");
    expect(primaryType(cardData("Teferi, Temporal Archmage"))).toBe(
      "Planeswalker",
    );
  });
});

describe("regroupement du deck", () => {
  const deck = [
    deckCard("Island", { quantity: 5 }),
    deckCard("Sol Ring", { categories: ["Ramp"] }),
    deckCard("Counterspell", { categories: ["Interaction", "Ramp"] }),
    deckCard("Birds of Paradise", { categories: ["Ramp"] }),
    deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
    deckCard("Lightning Bolt", { zone: "maybe" }),
  ];

  it("par type, dans l'ordre des types et sans groupe vide", () => {
    const grouped = groupDeck(deck, "type");
    expect(grouped.commanders.map((entry) => entry.card.name)).toEqual([
      "Atraxa, Praetors' Voice",
    ]);
    expect(grouped.groups.map((group) => group.id)).toEqual([
      "type:Creature",
      "type:Instant",
      "type:Artifact",
      "type:Land",
    ]);
    expect(grouped.maybe.map((entry) => entry.card.name)).toEqual([
      "Lightning Bolt",
    ]);
  });

  it("par catégorie principale, « sans catégorie » en dernier", () => {
    const grouped = groupDeck(deck, "category");
    expect(
      grouped.groups.map((group) => [
        group.id,
        group.cards.map((entry) => entry.card.name),
      ]),
    ).toEqual([
      ["category:Interaction", ["Counterspell"]],
      ["category:Ramp", ["Birds of Paradise", "Sol Ring"]],
      ["category:", ["Island"]],
    ]);
  });
});
