import { describe, expect, it } from "vitest";
import { colorsToMask, maskToColors } from "./colors";

describe("masque de couleurs", () => {
  it("encode chaque couleur sur un bit", () => {
    expect(colorsToMask([])).toBe(0);
    expect(colorsToMask(["W"])).toBe(1);
    expect(colorsToMask(["G"])).toBe(16);
    expect(colorsToMask(["W", "U", "B", "R", "G"])).toBe(31);
  });

  it("ignore les doublons et les valeurs inconnues", () => {
    expect(colorsToMask(["U", "U", "X", "C"])).toBe(2);
  });

  it("redonne les couleurs dans l'ordre WUBRG", () => {
    expect(maskToColors(colorsToMask(["G", "W", "B"]))).toEqual([
      "W",
      "B",
      "G",
    ]);
    expect(maskToColors(0)).toEqual([]);
  });

  it("permet de tester l'inclusion d'une identité dans une autre", () => {
    const commander = colorsToMask(["W", "U"]);
    const isWithin = (colors: string[]) =>
      (colorsToMask(colors) & ~commander) === 0;
    expect(isWithin(["W"])).toBe(true);
    expect(isWithin([])).toBe(true);
    expect(isWithin(["W", "U"])).toBe(true);
    expect(isWithin(["U", "B"])).toBe(false);
  });
});
