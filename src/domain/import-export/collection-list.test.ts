import { describe, expect, it } from "vitest";
import {
  collectionImportEntries,
  MAX_COLLECTION_IMPORT_LINES,
  parseCollectionList,
  splitCsvLine,
} from "./collection-list";
import { exportCollection } from "./export";

const cards = (text: string) =>
  parseCollectionList(text).cards.map(({ quantity, name }) => ({
    quantity,
    name,
  }));

describe("parseCollectionList", () => {
  it("lit une liste texte, sections comprises", () => {
    const list = parseCollectionList(
      "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n4 Lightning Bolt\n1 Sol Ring (CMM) 410\nTokens\n1 Treasure",
    );
    expect(list.format).toBe("text");
    expect(cards("4x Lightning Bolt\nSol Ring")).toEqual([
      { quantity: 4, name: "Lightning Bolt" },
      { quantity: 1, name: "Sol Ring" },
    ]);
    expect(list.cards.map((line) => line.name)).toEqual([
      "Atraxa, Praetors' Voice",
      "Lightning Bolt",
      "Sol Ring",
    ]);
  });

  it("lit l'export CSV de Moxfield", () => {
    const list = parseCollectionList(
      [
        '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil"',
        '"4","0","Lightning Bolt","2xm","Near Mint","English",""',
        '"1","0","Kongming, ""Sleeping Dragon""","ptk","Near Mint","English","foil"',
      ].join("\n"),
    );
    expect(list.format).toBe("csv");
    expect(
      list.cards.map(({ quantity, name }) => ({ quantity, name })),
    ).toEqual([
      { quantity: 4, name: "Lightning Bolt" },
      { quantity: 1, name: 'Kongming, "Sleeping Dragon"' },
    ]);
  });

  it("lit l'export CSV de ManaBox (nom avant la quantité)", () => {
    expect(
      cards(
        "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID\r\n" +
          "Sol Ring,CMM,Commander Masters,410,normal,uncommon,2,123\r\n" +
          '"Fire // Ice",MH2,Modern Horizons 2,290,foil,rare,1,456',
      ),
    ).toEqual([
      { quantity: 2, name: "Sol Ring" },
      { quantity: 1, name: "Fire // Ice" },
    ]);
  });

  it("lit un CSV séparé par des points-virgules, sans colonne de quantité", () => {
    expect(cards("Card Name;Set\nCounterspell;MH2")).toEqual([
      { quantity: 1, name: "Counterspell" },
    ]);
  });

  it("signale les lignes CSV illisibles", () => {
    const list = parseCollectionList("Count,Name\n0,Sol Ring\nabc,Island\n2,");
    expect(list.cards).toEqual([]);
    expect(list.invalid.map((line) => line.line)).toEqual([2, 3, 4]);
  });

  it("relit l'export de la collection", () => {
    const entries = [
      { name: "Sol Ring", quantity: 3 },
      { name: "Fire // Ice", quantity: 1 },
    ];
    for (const format of ["text", "csv"] as const) {
      expect(cards(exportCollection(entries, format)), format).toEqual([
        { quantity: 1, name: "Fire // Ice" },
        { quantity: 3, name: "Sol Ring" },
      ]);
    }
  });

  it("s'arrête après le nombre maximal de lignes", () => {
    const text = Array.from(
      { length: MAX_COLLECTION_IMPORT_LINES + 5 },
      (_, index) => `1 Card ${index}`,
    ).join("\n");
    const list = parseCollectionList(text);
    expect(list.cards).toHaveLength(MAX_COLLECTION_IMPORT_LINES);
    expect(list.truncated).toBe(true);
  });
});

describe("splitCsvLine", () => {
  it("garde les séparateurs entre guillemets", () => {
    expect(splitCsvLine('1,"a, b",""""', ",")).toEqual(["1", "a, b", '"']);
  });
});

describe("collectionImportEntries", () => {
  it("additionne les exemplaires d'une même carte et ignore les inconnues", () => {
    const { cards: lines } = parseCollectionList(
      "Count,Name\n2,Sol Ring\n1,sol ring\n1,Unknown Card\n9999,Island\n5,Island",
    );
    const ids: Record<string, string> = {
      "Sol Ring": "a",
      "sol ring": "a",
      Island: "b",
    };
    expect(
      collectionImportEntries(lines, (line) => ids[line.name] ?? null),
    ).toEqual([
      { oracleId: "a", quantity: 3 },
      { oracleId: "b", quantity: 9999 },
    ]);
  });
});

describe("éditions d'une liste de la collection", () => {
  const editions = (text: string) =>
    parseCollectionList(text).cards.map(
      ({ name, set, collectorNumber, foil, printingId }) => ({
        name,
        set,
        collectorNumber,
        foil,
        printingId,
      }),
    );

  it("lit l'édition et la finition d'une liste texte", () => {
    expect(
      editions(
        "1 Sol Ring (LEA) 269 *F*\n2 Lightning Bolt (M10) 146\n1 Island",
      ),
    ).toEqual([
      {
        name: "Sol Ring",
        set: "LEA",
        collectorNumber: "269",
        foil: true,
        printingId: null,
      },
      {
        name: "Lightning Bolt",
        set: "M10",
        collectorNumber: "146",
        foil: false,
        printingId: null,
      },
      {
        name: "Island",
        set: null,
        collectorNumber: null,
        foil: false,
        printingId: null,
      },
    ]);
  });

  it("lit les colonnes d'édition des CSV (Moxfield, ManaBox, Archidekt)", () => {
    expect(
      editions(
        [
          '"Count","Name","Edition","Collector Number","Foil"',
          '"1","Sol Ring","lea","269","foil"',
          '"2","Lightning Bolt","","",""',
        ].join("\n"),
      ),
    ).toEqual([
      {
        name: "Sol Ring",
        set: "LEA",
        collectorNumber: "269",
        foil: true,
        printingId: null,
      },
      {
        name: "Lightning Bolt",
        set: null,
        collectorNumber: null,
        foil: false,
        printingId: null,
      },
    ]);
    const id = "c4300d24-1cae-4dd5-be7e-38cc677cf5bd";
    expect(
      editions(
        [
          "Name,Set code,Collector number,Foil,Quantity,Scryfall ID",
          `Sol Ring,lea,269,normal,1,${id}`,
        ].join("\n"),
      ),
    ).toEqual([
      {
        name: "Sol Ring",
        set: "LEA",
        collectorNumber: "269",
        foil: false,
        printingId: id,
      },
    ]);
  });

  it("regroupe les exemplaires par carte et par édition", () => {
    const list = parseCollectionList(
      "1 Sol Ring (LEA) 269\n1 Sol Ring (LEA) 269\n1 Sol Ring (LEA) 269 *F*\n2 Sol Ring",
    );
    expect(
      collectionImportEntries(
        list.cards,
        () => "sol",
        (line) => (line.set ? "alpha" : null),
      ),
    ).toEqual([
      { oracleId: "sol", quantity: 2, printingId: "alpha", foil: false },
      { oracleId: "sol", quantity: 1, printingId: "alpha", foil: true },
      { oracleId: "sol", quantity: 2 },
    ]);
  });

  it("se relit après un export", () => {
    const exported = exportCollection(
      [
        {
          name: "Sol Ring",
          quantity: 2,
          printings: [
            { setCode: "lea", collectorNumber: "269", foil: true, quantity: 1 },
          ],
        },
      ],
      "csv",
    );
    expect(editions(exported)).toEqual([
      {
        name: "Sol Ring",
        set: "LEA",
        collectorNumber: "269",
        foil: true,
        printingId: null,
      },
      {
        name: "Sol Ring",
        set: null,
        collectorNumber: null,
        foil: false,
        printingId: null,
      },
    ]);
  });
});
