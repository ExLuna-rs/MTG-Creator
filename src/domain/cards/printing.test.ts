import { describe, expect, it } from "vitest";
import {
  isPaperPrinting,
  isSpecialPrinting,
  printingPrice,
  type ScryfallPrinting,
  toPrintingRow,
} from "./printing";
import { fixturePrinting } from "./test-fixtures";

const alpha = () => fixturePrinting("Sol Ring", "lea", "269");
const delver = () =>
  fixturePrinting("Delver of Secrets // Insectile Aberration", "isd", "51");

describe("isPaperPrinting", () => {
  it("garde les cartes papier", () => {
    expect(isPaperPrinting(alpha())).toBe(true);
    expect(isPaperPrinting(delver())).toBe(true);
  });

  it("écarte les versions numériques et les cartes géantes", () => {
    expect(isPaperPrinting({ ...alpha(), digital: true })).toBe(false);
    expect(isPaperPrinting({ ...alpha(), games: ["arena", "mtgo"] })).toBe(
      false,
    );
    expect(isPaperPrinting({ ...alpha(), oversized: true })).toBe(false);
  });

  it("écarte les jetons et les cartes d'illustration", () => {
    expect(
      isPaperPrinting({ ...alpha(), type_line: "Token Creature — Soldier" }),
    ).toBe(false);
    expect(isPaperPrinting({ ...alpha(), set_type: "token" })).toBe(false);
    expect(isPaperPrinting({ ...alpha(), layout: "art_series" })).toBe(false);
  });
});

describe("isSpecialPrinting", () => {
  it("considère les impressions d'extension comme normales", () => {
    expect(isSpecialPrinting(alpha())).toBe(false);
    expect(isSpecialPrinting(delver())).toBe(false);
  });

  it("repère les promos, Secret Lair et traitements spéciaux", () => {
    expect(isSpecialPrinting(fixturePrinting("Sol Ring", "sld", "2132"))).toBe(
      true,
    );
    const esika = "Esika, God of the Tree // The Prismatic Bridge";
    expect(isSpecialPrinting(fixturePrinting(esika, "pkhm", "168s"))).toBe(
      true,
    );
    expect(isSpecialPrinting(fixturePrinting(esika, "khm", "314"))).toBe(true);
    const special: Partial<ScryfallPrinting>[] = [
      { border_color: "borderless" },
      { full_art: true },
      { frame_effects: ["extendedart"] },
      { set_type: "funny" },
    ];
    for (const fields of special) {
      expect(isSpecialPrinting({ ...alpha(), ...fields })).toBe(true);
    }
  });
});

describe("toPrintingRow", () => {
  it("reprend l'édition, le numéro et les prix", () => {
    const row = toPrintingRow(alpha());
    expect(row).toMatchObject({
      setCode: "lea",
      setName: "Limited Edition Alpha",
      collectorNumber: "269",
      releasedAt: "1993-08-05",
      special: false,
      backImageUris: null,
    });
    expect(row.oracleId).toBe("6ad8011d-3471-4369-9d68-b264cc027487");
    expect(row.imageUris?.normal).toMatch(/^https:\/\/cards\.scryfall\.io\//);
    expect(row.priceEur).toBeGreaterThan(0);
  });

  it("prend les images des deux faces d'une carte recto verso", () => {
    const row = toPrintingRow(delver());
    expect(row.imageUris?.normal).toContain("/front/");
    expect(row.backImageUris?.normal).toContain("/back/");
  });
});

describe("printingPrice", () => {
  const prices = {
    priceEur: null,
    priceUsd: 2,
    priceEurFoil: 5,
    priceUsdFoil: 6,
  };

  it("prend le prix non brillant, sinon le prix brillant", () => {
    expect(printingPrice(prices, "USD")).toBe(2);
    expect(printingPrice(prices, "EUR")).toBe(5);
    expect(
      printingPrice({ ...prices, priceUsd: null, priceUsdFoil: null }, "USD"),
    ).toBeNull();
  });
});
