import { describe, expect, it } from "vitest";
import { CARD_ASPECT, guideRect, nameBand } from "./frame";

describe("cadre de visée", () => {
  it("garde le format d'une carte, centré", () => {
    const guide = guideRect(1280, 720);
    expect(guide.width / guide.height).toBeCloseTo(CARD_ASPECT);
    expect(guide.height).toBeCloseTo(720 * 0.85);
    expect(guide.x * 2 + guide.width).toBeCloseTo(1280);
    expect(guide.y * 2 + guide.height).toBeCloseTo(720);
  });

  it("tient dans la largeur d'une image en portrait étroite", () => {
    const guide = guideRect(400, 1000);
    expect(guide.width).toBeCloseTo(360);
    expect(guide.width / guide.height).toBeCloseTo(CARD_ASPECT);
  });

  it("place la bande du nom en haut à gauche de la carte", () => {
    const guide = { x: 100, y: 50, width: 630, height: 880 };
    const band = nameBand(guide);
    expect(band.y).toBeGreaterThan(guide.y);
    expect(band.y + band.height).toBeLessThan(guide.y + guide.height * 0.15);
    expect(band.x).toBeGreaterThan(guide.x);
    expect(band.x + band.width).toBeLessThan(guide.x + guide.width);
  });
});
