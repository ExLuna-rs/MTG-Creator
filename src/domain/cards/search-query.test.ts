import { describe, expect, it } from "vitest";
import {
  activeFilters,
  cardSearchToQuery,
  colorFilter,
  countActiveFilters,
  MAX_SUBTYPES,
  parseCardSearch,
  withoutFilter,
  withoutFilters,
} from "./search-query";

describe("parseCardSearch", () => {
  it("donne des valeurs par défaut sans paramètre", () => {
    expect(parseCardSearch({})).toEqual({
      name: "",
      text: "",
      colors: [],
      colorMode: "within",
      colorSource: "identity",
      types: [],
      subtypes: [],
      typeMode: "or",
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

  it("lit les modes de couleur et de type", () => {
    expect(
      parseCardSearch({ cmode: "exact", csrc: "card", tmode: "and" }),
    ).toMatchObject({
      colorMode: "exact",
      colorSource: "card",
      typeMode: "and",
    });
    expect(
      parseCardSearch({ cmode: "none", csrc: ["x"], tmode: "xor" }),
    ).toMatchObject({
      colorMode: "within",
      colorSource: "identity",
      typeMode: "or",
    });
  });

  it("lit les sous-types, sans doublon ni valeur suspecte", () => {
    expect(
      parseCardSearch({
        sub: [
          " Dinosaur ",
          "dinosaur",
          "Urza's",
          "Time Lord",
          "",
          "<b>",
          "x".repeat(41),
        ],
      }).subtypes,
    ).toEqual(["Dinosaur", "Urza's", "Time Lord"]);
    const many = Array.from({ length: 20 }, (_, index) => `Type${index}`);
    expect(parseCardSearch({ sub: many }).subtypes).toHaveLength(MAX_SUBTYPES);
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

describe("cardSearchToQuery", () => {
  it("n'écrit rien pour une recherche vide", () => {
    expect(cardSearchToQuery(parseCardSearch({}))).toEqual({});
  });

  it("omet le tri par défaut mais garde un tri choisi", () => {
    expect(cardSearchToQuery(parseCardSearch({ q: "bolt" }))).toEqual({
      q: "bolt",
    });
    expect(
      cardSearchToQuery(parseCardSearch({ q: "bolt", sort: "popularity" })),
    ).toEqual({ q: "bolt", sort: "popularity" });
  });

  it("redonne la même recherche une fois relue", () => {
    const params = {
      q: "elf",
      text: "draw a card",
      color: ["W", "G"],
      cmode: "all",
      csrc: "card",
      type: ["Creature", "Land"],
      sub: ["Elf", "Druid"],
      tmode: "and",
      rarity: ["rare", "mythic"],
      mvMin: "0",
      mvMax: "4",
      legal: "1",
      commander: "1",
      gc: "1",
      sort: "manaValue",
      page: "3",
    };
    const search = parseCardSearch(params);
    expect(cardSearchToQuery(search)).toEqual(params);
    expect(parseCardSearch(cardSearchToQuery(search))).toEqual(search);
  });
});

describe("countActiveFilters", () => {
  it("ne compte ni le nom, ni le tri, ni la page", () => {
    expect(
      countActiveFilters(
        parseCardSearch({ q: "bolt", sort: "name", page: "2" }),
      ),
    ).toBe(0);
  });

  it("compte chaque groupe de filtres une seule fois", () => {
    expect(
      countActiveFilters(
        parseCardSearch({
          color: ["W", "U"],
          type: "Creature",
          mvMin: "1",
          mvMax: "3",
          gc: "1",
        }),
      ),
    ).toBe(4);
  });
});

describe("activeFilters et withoutFilter", () => {
  const search = parseCardSearch({
    q: "elf",
    sort: "name",
    color: "G",
    cmode: "exact",
    sub: "Elf",
    tmode: "and",
    mvMax: "3",
    legal: "1",
    page: "2",
  });

  it("liste les groupes actifs dans l'ordre du formulaire", () => {
    expect(activeFilters(search)).toEqual([
      "colors",
      "types",
      "manaValue",
      "commanderLegal",
    ]);
    // Un mode seul, sans couleur ni type choisi, ne filtre rien.
    expect(
      activeFilters(parseCardSearch({ cmode: "exact", tmode: "and" })),
    ).toEqual([]);
  });

  it("retire un groupe avec ses modes et revient en page 1", () => {
    expect(cardSearchToQuery(withoutFilter(search, "colors"))).toEqual({
      q: "elf",
      sort: "name",
      sub: ["Elf"],
      tmode: "and",
      mvMax: "3",
      legal: "1",
    });
    expect(
      cardSearchToQuery(withoutFilter(search, "types")),
    ).not.toHaveProperty("tmode");
    expect(withoutFilter(search, "commanderLegal").commanderLegal).toBe(false);
  });

  it("efface tous les filtres mais garde le nom et le tri", () => {
    expect(cardSearchToQuery(withoutFilters(search))).toEqual({
      q: "elf",
      sort: "name",
    });
  });
});

describe("colorFilter", () => {
  it("ne filtre pas sans couleur", () => {
    expect(colorFilter(parseCardSearch({ cmode: "exact" }))).toBeNull();
  });

  it("garde les incolores avec « Incolore » seul, quel que soit le mode", () => {
    expect(colorFilter(parseCardSearch({ color: "C", cmode: "any" }))).toEqual({
      source: "identity",
      mode: "colorless",
    });
  });

  it("ignore « Incolore » avec d'autres couleurs", () => {
    expect(
      colorFilter(
        parseCardSearch({
          color: ["U", "C", "R"],
          cmode: "exact",
          csrc: "card",
        }),
      ),
    ).toEqual({ source: "card", mode: "exact", colors: ["U", "R"] });
  });
});
