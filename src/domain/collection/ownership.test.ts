import { describe, expect, it } from "vitest";
import {
  cardUsage,
  clampToNeeds,
  type DeckHolding,
  deckNeeds,
  deckStatus,
  fillWithFreeCopies,
  freeCopies,
  missingCopies,
  trimToOwned,
} from "./ownership";

function holding(
  deckId: string,
  fields: Partial<DeckHolding> = {},
): DeckHolding {
  return {
    deckId,
    name: deckId,
    assembled: false,
    needs: {},
    copies: {},
    ...fields,
  };
}

describe("besoins d'un deck", () => {
  it("additionne commandants et deck, sans les cartes à considérer", () => {
    expect(
      deckNeeds([
        { oracleId: "a", zone: "commander", quantity: 1 },
        { oracleId: "b", zone: "main", quantity: 3 },
        { oracleId: "b", zone: "maybe", quantity: 2 },
        { oracleId: "c", zone: "maybe", quantity: 1 },
      ]),
    ).toEqual({ a: 1, b: 3 });
  });
});

describe("statut d'un deck", () => {
  const needs = { a: 1, b: 2 };

  it("est en construction tant qu'il n'est pas monté", () => {
    expect(deckStatus(false, needs, { a: 1, b: 2 })).toBe("building");
  });

  it("est construit quand il manque des exemplaires physiques", () => {
    expect(deckStatus(true, needs, { a: 1, b: 1 })).toBe("built");
    expect(missingCopies(needs, { a: 1, b: 1 })).toEqual([
      { oracleId: "b", missing: 1 },
    ]);
  });

  it("est jouable quand toutes les cartes sont là", () => {
    expect(deckStatus(true, needs, { a: 1, b: 2 })).toBe("playable");
  });
});

describe("usage d'une carte de la collection", () => {
  const holdings = [
    holding("atraxa", {
      assembled: true,
      needs: { sol: 1 },
      copies: { sol: 1 },
    }),
    holding("krenko", { assembled: true, needs: { sol: 1 }, copies: {} }),
    holding("meren", { needs: { sol: 1 } }),
  ];

  it("distingue les decks qui l'utilisent de ceux qui la contiennent", () => {
    expect(cardUsage("sol", 1, holdings)).toEqual({
      used: 1,
      free: 0,
      missing: 1,
      usedIn: [{ deckId: "atraxa", copies: 1 }],
      wantedBy: [
        { deckId: "krenko", missing: 1 },
        { deckId: "meren", missing: 1 },
      ],
    });
  });

  it("ne compte pas comme manquant ce que couvrent les exemplaires libres", () => {
    const usage = cardUsage("sol", 3, holdings);
    expect(usage.free).toBe(2);
    expect(usage.missing).toBe(0);
  });

  it("ne compte pas les decks en construction dans les manques", () => {
    expect(cardUsage("sol", 1, [holdings[0], holdings[2]]).missing).toBe(0);
  });

  it("n'a jamais moins de zéro exemplaire libre", () => {
    expect(freeCopies(0, holdings, "sol")).toBe(0);
  });
});

describe("montage d'un deck", () => {
  it("prend les exemplaires libres, sans dépasser les besoins", () => {
    const holdings = [
      holding("a", { assembled: true, needs: { x: 1 }, copies: { x: 1 } }),
      holding("b", { needs: { x: 2, y: 1, z: 1 } }),
    ];
    expect(fillWithFreeCopies("b", { x: 2, y: 5 }, holdings)).toEqual({
      x: 1,
      y: 1,
    });
  });

  it("garde les exemplaires déjà rangés", () => {
    const holdings = [holding("a", { needs: { x: 2 }, copies: { x: 1 } })];
    expect(fillWithFreeCopies("a", { x: 1 }, holdings)).toEqual({ x: 1 });
  });
});

describe("cohérence des exemplaires", () => {
  it("ramène les exemplaires aux besoins du deck", () => {
    expect(clampToNeeds({ a: 3, b: 1, c: 1 }, { a: 2, b: 1 })).toEqual({
      a: 2,
      b: 1,
    });
  });

  it("retire les exemplaires en trop, dans l'ordre des decks", () => {
    expect(
      trimToOwned(1, [
        { deckId: "a", copies: 1 },
        { deckId: "b", copies: 2 },
      ]),
    ).toEqual([
      { deckId: "a", copies: 0 },
      { deckId: "b", copies: 1 },
    ]);
    expect(trimToOwned(5, [{ deckId: "a", copies: 2 }])).toEqual([]);
  });
});
