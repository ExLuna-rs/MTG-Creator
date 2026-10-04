import { describe, expect, it } from "vitest";
import type { DeckCard } from "../deck/deck";
import { deckCard } from "../deck/test-helpers";
import { validateCommanderDeck } from "./validate";

/** Complète le deck avec un terrain de base jusqu'à `size` cartes. */
function fillWith(cards: DeckCard[], basic: string, size = 100): DeckCard[] {
  const count = cards.reduce(
    (total, entry) => total + (entry.zone === "maybe" ? 0 : entry.quantity),
    0,
  );
  return [...cards, deckCard(basic, { quantity: size - count })];
}

const atraxaDeck = (cards: DeckCard[] = []) =>
  fillWith(
    [
      deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
      deckCard("Sol Ring"),
      deckCard("Counterspell"),
      deckCard("Birds of Paradise"),
      deckCard("Swords to Plowshares"),
      ...cards,
    ],
    "Island",
  );

const codes = (deck: DeckCard[]) =>
  validateCommanderDeck(deck).issues.map((issue) => issue.code);

describe("validation d'un deck Commander", () => {
  it("accepte un deck de 100 cartes qui respecte les règles", () => {
    const result = validateCommanderDeck(atraxaDeck());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.size).toBe(100);
    expect(result.colorIdentity).toBe(1 | 2 | 4 | 16);
  });

  it("exige exactement 100 cartes, commandant compris", () => {
    const short = atraxaDeck().slice(0, -1);
    const result = validateCommanderDeck(short);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "deckSize", count: 5, expected: 100 }),
    );

    const long = [...atraxaDeck(), deckCard("Command Tower")];
    expect(validateCommanderDeck(long).issues).toContainEqual(
      expect.objectContaining({ code: "deckSize", count: 101 }),
    );
  });

  it("ignore les cartes à considérer", () => {
    const deck = [
      ...atraxaDeck(),
      deckCard("Lightning Bolt", { zone: "maybe" }),
      deckCard("Mana Crypt", { zone: "maybe" }),
    ];
    expect(validateCommanderDeck(deck).valid).toBe(true);
  });

  it("exige un commandant", () => {
    const deck = fillWith([deckCard("Sol Ring")], "Island");
    expect(codes(deck)).toEqual(["noCommander"]);
  });

  it("refuse un commandant qui n'en est pas un", () => {
    const deck = fillWith(
      [deckCard("Birds of Paradise", { zone: "commander" })],
      "Forest",
    );
    expect(codes(deck)).toEqual(["notACommander"]);
    expect(validateCommanderDeck(deck).cardIssues).toEqual({
      [deck[0].oracleId]: ["notACommander"],
    });
  });

  it("accepte un planeswalker qui peut être commandant", () => {
    const deck = fillWith(
      [deckCard("Teferi, Temporal Archmage", { zone: "commander" })],
      "Island",
    );
    expect(validateCommanderDeck(deck).valid).toBe(true);
  });

  it("refuse un Background seul", () => {
    const deck = fillWith(
      [deckCard("Guild Artisan", { zone: "commander" })],
      "Mountain",
    );
    expect(codes(deck)).toEqual(["notACommander"]);
  });

  it("accepte une paire valide et additionne les identités couleur", () => {
    const deck = fillWith(
      [
        deckCard("Thrasios, Triton Hero", { zone: "commander" }),
        deckCard("Tymna the Weaver", { zone: "commander" }),
        deckCard("Swords to Plowshares"),
        deckCard("Birds of Paradise"),
      ],
      "Swamp",
    );
    const result = validateCommanderDeck(deck);
    expect(result.valid).toBe(true);
    expect(result.colorIdentity).toBe(1 | 2 | 4 | 16);
  });

  it("accepte Choose a Background avec un Background", () => {
    const deck = fillWith(
      [
        deckCard("Wilson, Refined Grizzly", { zone: "commander" }),
        deckCard("Guild Artisan", { zone: "commander" }),
        deckCard("Lightning Bolt"),
      ],
      "Forest",
    );
    expect(validateCommanderDeck(deck).valid).toBe(true);
  });

  it("refuse une paire invalide et plus de deux commandants", () => {
    const pair = fillWith(
      [
        deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
        deckCard("Thrasios, Triton Hero", { zone: "commander" }),
      ],
      "Island",
    );
    expect(codes(pair)).toEqual(["invalidPair"]);

    const three = fillWith(
      [
        deckCard("Thrasios, Triton Hero", { zone: "commander" }),
        deckCard("Tymna the Weaver", { zone: "commander" }),
        deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
      ],
      "Island",
    );
    expect(codes(three)).toEqual(["tooManyCommanders"]);
  });

  it("refuse les cartes hors de l'identité couleur du commandant", () => {
    const deck = atraxaDeck([
      deckCard("Lightning Bolt"),
      deckCard("Fire // Ice"),
    ]);
    const issue = validateCommanderDeck(deck).issues.find(
      (item) => item.code === "colorIdentity",
    );
    expect(issue && "cards" in issue && issue.cards.map((c) => c.name)).toEqual(
      ["Lightning Bolt", "Fire // Ice"],
    );
  });

  it("accepte les cartes incolores dans toutes les identités", () => {
    const deck = fillWith(
      [
        deckCard("Wilson, Refined Grizzly", { zone: "commander" }),
        deckCard("Sol Ring"),
        deckCard("Wastes", { quantity: 3 }),
      ],
      "Forest",
    );
    expect(validateCommanderDeck(deck).valid).toBe(true);
  });

  it("refuse les doublons, sauf les exceptions au singleton", () => {
    const deck = atraxaDeck([
      deckCard("Command Tower", { quantity: 2 }),
      deckCard("Relentless Rats", { quantity: 20 }),
      deckCard("Persistent Petitioners", { quantity: 12 }),
    ]);
    const issue = validateCommanderDeck(deck).issues.find(
      (item) => item.code === "tooManyCopies",
    );
    expect(issue).toMatchObject({
      cards: [{ name: "Command Tower", count: 2, max: 1 }],
    });
  });

  it("compte les exemplaires d'une carte présente dans deux zones", () => {
    const deck = fillWith(
      [
        deckCard("Atraxa, Praetors' Voice", { zone: "commander" }),
        deckCard("Atraxa, Praetors' Voice"),
      ],
      "Island",
    );
    expect(codes(deck)).toContain("tooManyCopies");
  });

  it("limite Seven Dwarves à sept exemplaires", () => {
    const ok = fillWith(
      [
        deckCard("Edgar Markov", { zone: "commander" }),
        deckCard("Seven Dwarves", { quantity: 7 }),
      ],
      "Mountain",
    );
    expect(validateCommanderDeck(ok).valid).toBe(true);
    const tooMany = fillWith(
      [
        deckCard("Edgar Markov", { zone: "commander" }),
        deckCard("Seven Dwarves", { quantity: 8 }),
      ],
      "Mountain",
    );
    expect(codes(tooMany)).toEqual(["tooManyCopies"]);
  });

  it("refuse les cartes bannies et non légales en Commander", () => {
    const deck = atraxaDeck([
      deckCard("Mana Crypt"),
      deckCard("Jeweled Lotus"),
      deckCard("Gleemax"),
    ]);
    const result = validateCommanderDeck(deck);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "banned",
        cards: [
          expect.objectContaining({ name: "Mana Crypt" }),
          expect.objectContaining({ name: "Jeweled Lotus" }),
        ],
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "notLegal",
        cards: [expect.objectContaining({ name: "Gleemax" })],
      }),
    );
  });

  it("compte les Game Changers sans invalider le deck", () => {
    const deck = atraxaDeck([
      deckCard("Rhystic Study"),
      deckCard("Demonic Tutor"),
      deckCard("Cyclonic Rift"),
      deckCard("Smothering Tithe"),
    ]);
    const result = validateCommanderDeck(deck);
    expect(result.valid).toBe(true);
    expect(result.gameChangers).toBe(4);
    expect(result.minimumBracket).toBe(4);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "gameChangers",
        severity: "info",
        count: 4,
        minimumBracket: 4,
      }),
    ]);
  });
});
