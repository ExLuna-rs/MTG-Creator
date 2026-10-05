import { describe, expect, it } from "vitest";
import { cardData } from "../deck/test-helpers";
import { maxCopies } from "./singleton";

describe("nombre maximal d'exemplaires", () => {
  it("limite les cartes ordinaires à un exemplaire", () => {
    expect(maxCopies(cardData("Sol Ring"))).toBe(1);
    expect(maxCopies(cardData("Command Tower"))).toBe(1);
  });

  it("n'en limite pas les terrains de base, enneigés et Wastes compris", () => {
    for (const name of ["Island", "Snow-Covered Forest", "Wastes"]) {
      expect(maxCopies(cardData(name))).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("suit le texte « any number of cards named »", () => {
    expect(maxCopies(cardData("Relentless Rats"))).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(maxCopies(cardData("Shadowborn Apostle"))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("suit le texte « up to seven / nine cards named »", () => {
    expect(maxCopies(cardData("Seven Dwarves"))).toBe(7);
    expect(maxCopies(cardData("Nazgûl"))).toBe(9);
  });
});
