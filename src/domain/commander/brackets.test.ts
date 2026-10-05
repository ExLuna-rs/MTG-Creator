import { describe, expect, it } from "vitest";
import { BRACKET_RULES, minimumBracket } from "./brackets";

describe("brackets et Game Changers", () => {
  it("sans Game Changer, tous les brackets sont possibles", () => {
    expect(minimumBracket(0)).toBe(1);
  });

  it("jusqu'à trois Game Changers : bracket 3 au minimum", () => {
    expect(minimumBracket(1)).toBe(3);
    expect(minimumBracket(3)).toBe(3);
  });

  it("au-delà de trois : bracket 4 au minimum", () => {
    expect(minimumBracket(4)).toBe(4);
    expect(minimumBracket(40)).toBe(4);
  });

  it("décrit les cinq brackets dans l'ordre", () => {
    expect(BRACKET_RULES.brackets.map(({ level }) => level)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });
});
