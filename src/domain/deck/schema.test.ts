import { describe, expect, it } from "vitest";
import { deckSaveSchema, newDeckSchema } from "./schema";

const id = "4b0c7f1a-1c3e-4f0a-9a7e-0c3b5d1e2f3a";
const other = "9a3f1b2c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

describe("sauvegarde d'un deck", () => {
  it("accepte un deck bien formé", () => {
    const result = deckSaveSchema.safeParse({
      name: "  Atraxa  ",
      entries: [
        { oracleId: id, zone: "commander", quantity: 1, categories: [] },
        { oracleId: id, zone: "maybe", quantity: 2, categories: ["Rampe"] },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Atraxa");
  });

  it("refuse les doublons dans une zone et les commandants en plusieurs exemplaires", () => {
    expect(
      deckSaveSchema.safeParse({
        name: "Deck",
        entries: [
          { oracleId: id, zone: "main", quantity: 1, categories: [] },
          { oracleId: id, zone: "main", quantity: 1, categories: [] },
        ],
      }).success,
    ).toBe(false);
    expect(
      deckSaveSchema.safeParse({
        name: "Deck",
        entries: [
          { oracleId: id, zone: "commander", quantity: 2, categories: [] },
        ],
      }).success,
    ).toBe(false);
  });

  it("refuse les valeurs hors limites", () => {
    const bad = [
      { name: "", entries: [] },
      { name: "x".repeat(101), entries: [] },
      {
        name: "Deck",
        entries: [
          {
            oracleId: "pas-un-uuid",
            zone: "main",
            quantity: 1,
            categories: [],
          },
        ],
      },
      {
        name: "Deck",
        entries: [{ oracleId: id, zone: "side", quantity: 1, categories: [] }],
      },
      {
        name: "Deck",
        entries: [{ oracleId: id, zone: "main", quantity: 0, categories: [] }],
      },
      {
        name: "Deck",
        entries: [
          { oracleId: id, zone: "main", quantity: 1.5, categories: [] },
        ],
      },
      {
        name: "Deck",
        entries: [
          {
            oracleId: id,
            zone: "main",
            quantity: 1,
            categories: ["x".repeat(41)],
          },
        ],
      },
    ];
    for (const value of bad) {
      expect(deckSaveSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("nouveau deck", () => {
  it("demande un commandant, et un partenaire différent", () => {
    expect(newDeckSchema.safeParse({ commanderId: id }).success).toBe(true);
    expect(
      newDeckSchema.safeParse({ commanderId: id, partnerId: other }).success,
    ).toBe(true);
    expect(
      newDeckSchema.safeParse({ commanderId: id, partnerId: id }).success,
    ).toBe(false);
    expect(newDeckSchema.safeParse({}).success).toBe(false);
  });
});
