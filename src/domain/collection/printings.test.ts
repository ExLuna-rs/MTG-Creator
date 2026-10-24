import { describe, expect, it } from "vitest";
import {
  clampPrintingQuantity,
  copiesValue,
  copyPrice,
  hasFinish,
  type PrintingSplit,
  unspecifiedCopies,
} from "./printings";

const prices = {
  priceEur: 1,
  priceUsd: 2,
  priceEurFoil: 5,
  priceUsdFoil: null,
};

const printing = (id: string) => ({
  id,
  setCode: "lea",
  setName: "Limited Edition Alpha",
  collectorNumber: "269",
  finishes: ["nonfoil", "foil"],
  imageUris: null,
  ...prices,
});

describe("exemplaires précisés", () => {
  const split = [
    { printingId: "a", foil: false, quantity: 2 },
    { printingId: "a", foil: true, quantity: 1 },
  ];

  it("compte les exemplaires sans édition", () => {
    expect(unspecifiedCopies(4, split)).toBe(1);
    expect(unspecifiedCopies(2, split)).toBe(0);
    expect(unspecifiedCopies(3, [])).toBe(3);
  });

  it("ne dépasse jamais les exemplaires possédés", () => {
    const target = { printingId: "a", foil: true };
    expect(clampPrintingQuantity(5, 4, split, target)).toBe(2);
    expect(clampPrintingQuantity(0, 4, split, target)).toBe(0);
    expect(
      clampPrintingQuantity(3, 4, split, { printingId: "b", foil: false }),
    ).toBe(1);
  });
});

describe("finitions et prix", () => {
  it("reconnaît les finitions d'une édition", () => {
    expect(hasFinish({ finishes: ["nonfoil"] }, false)).toBe(true);
    expect(hasFinish({ finishes: ["nonfoil"] }, true)).toBe(false);
    expect(hasFinish({ finishes: ["etched"] }, true)).toBe(true);
  });

  it("prend le prix de la finition, sinon celui de l'autre", () => {
    expect(copyPrice(prices, false, "EUR")).toBe(1);
    expect(copyPrice(prices, true, "EUR")).toBe(5);
    expect(copyPrice(prices, true, "USD")).toBe(2);
    expect(copyPrice({ ...prices, priceUsd: null }, false, "USD")).toBeNull();
  });

  it("évalue les exemplaires d'après leur édition", () => {
    const split: PrintingSplit = [
      { printingId: "a", foil: true, quantity: 2, printing: printing("a") },
    ];
    // 2 brillants à 5 €, 1 sans édition au prix par défaut (0,5 €).
    expect(copiesValue(3, 0.5, split, "EUR")).toBe(10.5);
    expect(copiesValue(3, null, [], "EUR")).toBe(0);
  });
});
