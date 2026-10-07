import { describe, expect, it } from "vitest";
import { nameBand } from "./frame";

describe("bande du nom", () => {
  it("est en haut à gauche de la carte", () => {
    const card = { x: 100, y: 50, width: 630, height: 880 };
    const band = nameBand(card);
    expect(band.y).toBeGreaterThan(card.y);
    expect(band.y + band.height).toBeLessThan(card.y + card.height * 0.15);
    expect(band.x).toBeGreaterThan(card.x);
    expect(band.x + band.width).toBeLessThan(card.x + card.width);
  });
});
