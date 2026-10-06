import { describe, expect, it } from "vitest";
import { cleanScannedName, confidentMatch } from "./ocr-name";

describe("nettoyage du nom lu", () => {
  // Lectures de Tesseract sur des bandes de nom photographiées.
  it.each([
    ["Sol Ring", "Sol Ring"],
    ["| Sol Ring @", "Sol Ring"],
    ["Lightning Bolt ®\n", "Lightning Bolt"],
    ["l Counterspell UU", "Counterspell"],
    ["Atraxa, Praetors' Voice 1GWUB", "Atraxa, Praetors' Voice"],
    ["Cultivate 2G", "Cultivate"],
    ["\n\nSwords to Plowshares W |\n", "Swords to Plowshares"],
    ["— Jötun Grunt —", "Jötun Grunt"],
    ["Arcane Signet ~~", "Arcane Signet"],
    ["Krenko, Mob Boss 2RR", "Krenko, Mob Boss"],
  ])("« %s » devient « %s »", (raw, expected) => {
    expect(cleanScannedName(raw)).toBe(expected);
  });

  it("garde la ligne la plus longue", () => {
    expect(cleanScannedName("a\nCommand Tower\n.")).toBe("Command Tower");
  });

  it("ne garde rien d'une lecture trop courte ou sans lettre", () => {
    expect(cleanScannedName("")).toBe("");
    expect(cleanScannedName("| . 12 @")).toBe("");
    expect(cleanScannedName("ab")).toBe("");
  });
});

describe("carte reconnue avec assurance", () => {
  const card = (name: string, similarity: number) => ({
    oracleId: name,
    name,
    similarity,
  });

  it("retient une carte très ressemblante", () => {
    expect(
      confidentMatch([card("Sol Ring", 0.9), card("Soul Ring", 0.8)])?.name,
    ).toBe("Sol Ring");
  });

  it("retient une carte moyennement ressemblante mais nettement devant", () => {
    expect(
      confidentMatch([card("Cultivate", 0.6), card("Cult", 0.3)])?.name,
    ).toBe("Cultivate");
    expect(confidentMatch([card("Cultivate", 0.6)])?.name).toBe("Cultivate");
  });

  it("hésite entre deux cartes proches ou peu ressemblantes", () => {
    expect(confidentMatch([card("A", 0.6), card("B", 0.55)])).toBeNull();
    expect(confidentMatch([card("A", 0.4)])).toBeNull();
    expect(confidentMatch([])).toBeNull();
  });
});
