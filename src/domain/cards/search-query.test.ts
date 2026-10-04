import { describe, expect, it } from "vitest";
import { parseCardSearch } from "./search-query";

describe("parseCardSearch", () => {
  it("donne des valeurs par défaut sans paramètre", () => {
    expect(parseCardSearch({})).toEqual({
      name: "",
      text: "",
      colors: [],
      types: [],
      rarities: [],
      manaValueMin: null,
      manaValueMax: null,
      commanderLegal: false,
      canBeCommander: false,
      gameChanger: false,
      sort: "popularity",
      page: 1,
    });
  });

  it("trie par pertinence quand un nom est recherché", () => {
    expect(parseCardSearch({ q: "  sol ring " })).toMatchObject({
      name: "sol ring",
      sort: "relevance",
    });
  });

  it("lit les filtres répétés et ignore les valeurs inconnues", () => {
    const search = parseCardSearch({
      color: ["U", "W", "X", "U"],
      type: ["Creature", "Pirate"],
      rarity: "mythic",
    });
    expect(search.colors).toEqual(["W", "U"]);
    expect(search.types).toEqual(["Creature"]);
    expect(search.rarities).toEqual(["mythic"]);
  });

  it("lit les cases à cocher et les bornes de valeur de mana", () => {
    expect(
      parseCardSearch({
        legal: "1",
        commander: "on",
        gc: "0",
        mvMin: "2",
        mvMax: "5",
      }),
    ).toMatchObject({
      commanderLegal: true,
      canBeCommander: true,
      gameChanger: false,
      manaValueMin: 2,
      manaValueMax: 5,
    });
  });

  it("ignore les valeurs invalides ou trafiquées", () => {
    expect(
      parseCardSearch({
        mvMin: "-3",
        mvMax: "abc",
        page: "999999",
        sort: "drop table",
        q: "x".repeat(500),
      }),
    ).toMatchObject({
      manaValueMin: null,
      manaValueMax: null,
      page: 1,
      sort: "popularity",
      name: "",
    });
  });

  it("refuse le tri par pertinence sans nom", () => {
    expect(parseCardSearch({ sort: "relevance" }).sort).toBe("popularity");
    expect(parseCardSearch({ sort: "name" }).sort).toBe("name");
  });
});
