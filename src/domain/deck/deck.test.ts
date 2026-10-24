import { describe, expect, it } from "vitest";
import { joinDeckCards, withPrinting } from "./deck";
import { cardData, deckPrinting } from "./test-helpers";

const solRing = cardData("Sol Ring");
const alpha = deckPrinting("Sol Ring", "lea", "269");

describe("withPrinting", () => {
  it("prend l'image et les prix de l'édition choisie", () => {
    const card = withPrinting(solRing, alpha);
    expect(card.imageUris).toEqual(alpha.imageUris);
    expect(card.priceEur).toBe(alpha.priceEur);
    expect(card.priceUsd).toBe(alpha.priceUsd);
    expect(card.name).toBe("Sol Ring");
  });

  it("garde la carte sans édition ou avec l'édition d'une autre carte", () => {
    expect(withPrinting(solRing, null)).toBe(solRing);
    const bolt = cardData("Lightning Bolt");
    expect(withPrinting(bolt, alpha)).toBe(bolt);
  });
});

describe("joinDeckCards", () => {
  const cards = { [solRing.oracleId]: solRing };
  const printings = { [alpha.id]: alpha };
  const entry = {
    oracleId: solRing.oracleId,
    zone: "main" as const,
    quantity: 1,
    categories: [],
  };

  it("joint la carte et l'édition choisie", () => {
    const [joined] = joinDeckCards(
      [{ ...entry, printingId: alpha.id }],
      cards,
      printings,
    );
    expect(joined.printing).toBe(alpha);
    expect(joined.card.priceEur).toBe(alpha.priceEur);
  });

  it("revient à l'édition par défaut si l'édition est inconnue", () => {
    const [joined] = joinDeckCards(
      [{ ...entry, printingId: "00000000-0000-0000-0000-000000000000" }],
      cards,
      printings,
    );
    expect(joined.printing).toBeNull();
    expect(joined.card).toBe(solRing);
  });

  it("écarte les cartes inconnues", () => {
    expect(
      joinDeckCards([{ ...entry, oracleId: "inconnue" }], cards, printings),
    ).toEqual([]);
  });
});
