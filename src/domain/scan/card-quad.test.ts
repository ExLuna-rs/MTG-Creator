import { describe, expect, it } from "vitest";
import {
  isCardShaped,
  orderCorners,
  type Quad,
  quadArea,
  quadShift,
  STEADY_SHIFT,
  smoothQuad,
} from "./card-quad";

// Carte debout de 630 × 880, coin haut gauche en (100, 50).
const upright: Quad = [
  { x: 100, y: 50 },
  { x: 730, y: 50 },
  { x: 730, y: 930 },
  { x: 100, y: 930 },
];

describe("orderCorners", () => {
  it("range les coins quel que soit leur ordre d'arrivée", () => {
    const shuffled = [upright[2], upright[0], upright[3], upright[1]];
    expect(orderCorners(shuffled)).toEqual(upright);
  });

  it("redresse une carte couchée, le haut sur un petit côté", () => {
    // Carte couchée : 880 de large, 630 de haut.
    const lying = [
      { x: 0, y: 0 },
      { x: 880, y: 0 },
      { x: 880, y: 630 },
      { x: 0, y: 630 },
    ];
    const quad = orderCorners(lying);
    const top = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
    const side = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
    expect(top).toBeCloseTo(630);
    expect(side).toBeCloseTo(880);
  });

  it("garde l'ordre d'une carte un peu tournée", () => {
    const tilted = [
      { x: 120, y: 40 },
      { x: 745, y: 70 },
      { x: 710, y: 945 },
      { x: 85, y: 915 },
    ];
    expect(orderCorners(tilted)[0]).toEqual({ x: 120, y: 40 });
    expect(orderCorners(tilted)[2]).toEqual({ x: 710, y: 945 });
  });

  it("refuse un nombre de coins différent de 4", () => {
    expect(() => orderCorners(upright.slice(0, 3))).toThrow();
  });
});

describe("isCardShaped", () => {
  it("reconnaît le format d'une carte", () => {
    expect(quadArea(upright)).toBe(630 * 880);
    expect(isCardShaped(upright, 1080 * 1920)).toBe(true);
  });

  it("refuse un carré ou un contour trop petit", () => {
    const square: Quad = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 800 },
      { x: 0, y: 800 },
    ];
    expect(isCardShaped(square, 1080 * 1920)).toBe(false);
    expect(isCardShaped(upright, 630 * 880 * 100)).toBe(false);
  });
});

describe("stabilité", () => {
  const moved = upright.map((p) => ({ x: p.x + 5, y: p.y })) as Quad;

  it("mesure le déplacement par rapport à la diagonale", () => {
    expect(quadShift(upright, upright)).toBe(0);
    expect(quadShift(upright, moved)).toBeLessThan(STEADY_SHIFT);
  });

  it("lisse le contour, sauf après un saut", () => {
    expect(smoothQuad(upright, moved, 0.5)[0].x).toBe(102.5);
    const far = upright.map((p) => ({ x: p.x + 600, y: p.y })) as Quad;
    expect(smoothQuad(upright, far)).toBe(far);
    expect(smoothQuad(null, moved)).toBe(moved);
  });
});
