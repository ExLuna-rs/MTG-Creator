import { describe, expect, it } from "vitest";
import {
  binderNameSchema,
  clampBinderQuantity,
  copiesInView,
  parseBinderView,
  unsortedCopies,
} from "./binders";

const RED = "0b8a3c5e-6f7d-4e2a-9c1b-3d4e5f6a7b8c";
const TRADE = "1c9b4d6f-7a8e-4f3b-8d2c-4e5f6a7b8c9d";

describe("parseBinderView", () => {
  it("lit les non rangés et un classeur, et montre tout sinon", () => {
    expect(parseBinderView("none")).toBe("none");
    expect(parseBinderView(RED)).toEqual({ id: RED });
    expect(parseBinderView("rouge")).toBe("all");
    expect(parseBinderView(undefined)).toBe("all");
    expect(parseBinderView([RED])).toBe("all");
  });
});

describe("binderNameSchema", () => {
  it("retire les espaces et refuse un nom vide ou trop long", () => {
    expect(binderNameSchema.parse("  Classeur rouge ")).toBe("Classeur rouge");
    expect(binderNameSchema.safeParse("   ").success).toBe(false);
    expect(binderNameSchema.safeParse("x".repeat(51)).success).toBe(false);
  });
});

describe("répartition des exemplaires", () => {
  const split = { [RED]: 2, [TRADE]: 1 };

  it("compte les non rangés et les exemplaires de chaque vue", () => {
    expect(unsortedCopies(4, split)).toBe(1);
    expect(unsortedCopies(2, split)).toBe(0);
    expect(copiesInView(4, split, "all")).toBe(4);
    expect(copiesInView(4, split, "none")).toBe(1);
    expect(copiesInView(4, split, { id: TRADE })).toBe(1);
    expect(copiesInView(4, {}, { id: RED })).toBe(0);
  });

  it("ne range jamais plus d'exemplaires que possédés", () => {
    expect(clampBinderQuantity(3, 4, split, RED)).toBe(3);
    expect(clampBinderQuantity(5, 4, split, RED)).toBe(3);
    expect(clampBinderQuantity(2, 4, split, "autre")).toBe(1);
    expect(clampBinderQuantity(-1, 4, split, RED)).toBe(0);
  });
});
