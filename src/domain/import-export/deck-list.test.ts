import { describe, expect, it } from "vitest";
import { parseDeckList } from "./deck-list";

const cards = (text: string) =>
  parseDeckList(text).cards.map(({ quantity, name, zone }) => ({
    quantity,
    name,
    zone,
  }));

describe("lecture d'une liste de cartes", () => {
  it("lit les quantités, avec ou sans « x », et les lignes sans quantité", () => {
    expect(cards("1 Sol Ring\n2x Island\n3 x Forest\nCounterspell")).toEqual([
      { quantity: 1, name: "Sol Ring", zone: "main" },
      { quantity: 2, name: "Island", zone: "main" },
      { quantity: 3, name: "Forest", zone: "main" },
      { quantity: 1, name: "Counterspell", zone: "main" },
    ]);
  });

  it("ne prend pas le début d'un nom pour un « x »", () => {
    expect(cards("1 Xenagos, God of Revels")[0].name).toBe(
      "Xenagos, God of Revels",
    );
  });

  it("lit l'édition, le numéro et la finition (Moxfield, MTG Arena)", () => {
    const [line] = parseDeckList("1 Sol Ring (CMM) 410 *F*").cards;
    expect(line).toMatchObject({
      name: "Sol Ring",
      set: "CMM",
      collectorNumber: "410",
    });
    expect(parseDeckList("1 Sol Ring (c21)").cards[0]).toMatchObject({
      name: "Sol Ring",
      set: "C21",
      collectorNumber: null,
    });
    expect(parseDeckList("1 [CMM] Sol Ring").cards[0]).toMatchObject({
      name: "Sol Ring",
      set: "CMM",
    });
  });

  it("garde les noms des cartes doubles", () => {
    expect(cards("1 Fire // Ice\n1 Delver of Secrets")).toEqual([
      { quantity: 1, name: "Fire // Ice", zone: "main" },
      { quantity: 1, name: "Delver of Secrets", zone: "main" },
    ]);
  });

  it("reconnaît les sections de MTG Arena et de Moxfield", () => {
    const text = [
      "About",
      "Name Atraxa superfriends",
      "",
      "Commander",
      "1 Atraxa, Praetors' Voice",
      "",
      "Deck",
      "1 Sol Ring",
      "",
      "Sideboard",
      "1 Lightning Bolt",
      "",
      "Tokens",
      "1 Treasure",
    ].join("\n");
    expect(cards(text)).toEqual([
      { quantity: 1, name: "Atraxa, Praetors' Voice", zone: "commander" },
      { quantity: 1, name: "Sol Ring", zone: "main" },
      { quantity: 1, name: "Lightning Bolt", zone: "maybe" },
    ]);
  });

  it("reconnaît les titres avec deux-points, commentaire ou nombre de cartes", () => {
    const text = [
      "// Commander (1)",
      "1 Atraxa, Praetors' Voice",
      "Mainboard (99)",
      "1 Sol Ring",
      "// Creatures",
      "1 Llanowar Elves",
      "SIDEBOARD:",
      "1 Lightning Bolt",
      "# Maybeboard",
      "1 Counterspell",
    ].join("\n");
    expect(cards(text).map(({ zone }) => zone)).toEqual([
      "commander",
      "main",
      "main",
      "maybe",
      "maybe",
    ]);
  });

  it("lit les catégories d'Archidekt et en tire la zone", () => {
    const { cards: lines } = parseDeckList(
      [
        "1x Atraxa, Praetors' Voice (2x2) 190 [Commander{top}]",
        "1x Sol Ring (cmm) 410 *F* [Ramp,Artifact] ^Have,#37d67a^",
        "1x Lightning Bolt [Maybeboard{noDeck}{noPrice},Burn]",
        "1x Counterspell [Creatures]",
      ].join("\n"),
    );
    expect(
      lines.map(({ name, zone, categories }) => ({ name, zone, categories })),
    ).toEqual([
      { name: "Atraxa, Praetors' Voice", zone: "commander", categories: [] },
      { name: "Sol Ring", zone: "main", categories: ["Ramp"] },
      { name: "Lightning Bolt", zone: "maybe", categories: ["Burn"] },
      { name: "Counterspell", zone: "main", categories: [] },
    ]);
  });

  it("ignore les lignes vides et les commentaires, signale les lignes illisibles", () => {
    const parsed = parseDeckList(
      "\n// Liste de test\n# autre commentaire\n0 Sol Ring\n2 ---\n1 Island\n",
    );
    expect(parsed.cards.map(({ name, line }) => ({ name, line }))).toEqual([
      { name: "Island", line: 6 },
    ]);
    expect(parsed.invalid).toEqual([
      { line: 4, text: "0 Sol Ring" },
      { line: 5, text: "2 ---" },
    ]);
  });

  it("accepte les fins de ligne Windows", () => {
    expect(cards("1 Sol Ring\r\n1 Island\r\n")).toHaveLength(2);
  });
});
