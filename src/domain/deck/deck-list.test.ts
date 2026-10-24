import { describe, expect, it } from "vitest";
import {
  deckListQueryToParams,
  type ListedDeck,
  parseDeckListQuery,
  selectDecks,
} from "./deck-list";

const FOLDER = "0b6c5d4e-1f2a-4b3c-8d9e-0a1b2c3d4e5f";

function deck(name: string, overrides: Partial<ListedDeck> = {}): ListedDeck {
  return {
    name,
    commanders: [{ name: `${name} Commander` }],
    colorIdentity: 0,
    valid: true,
    status: "building",
    priceEur: 0,
    priceUsd: 0,
    updatedAt: new Date("2026-10-01"),
    createdAt: new Date("2026-09-01"),
    folderId: null,
    favorite: false,
    ...overrides,
  };
}

const names = (decks: ListedDeck[]) => decks.map((item) => item.name);

describe("paramètres de « Mes decks »", () => {
  it("lit les valeurs valides et ignore les autres", () => {
    expect(
      parseDeckListQuery({
        folder: FOLDER,
        q: "  atraxa ",
        colors: "gwx",
        status: "playable",
        valid: "invalid",
        sort: "commander",
      }),
    ).toEqual({
      folder: { id: FOLDER },
      q: "atraxa",
      colors: ["W", "G"],
      status: "playable",
      validity: "invalid",
      sort: "commander",
    });
    expect(
      parseDeckListQuery({ folder: "x", status: "nope", sort: "random" }),
    ).toEqual({
      folder: "all",
      q: "",
      colors: [],
      status: null,
      validity: null,
      sort: "updated",
    });
    expect(parseDeckListQuery({ folder: "favorites" }).folder).toBe(
      "favorites",
    );
  });

  it("écrit l'adresse sans les valeurs par défaut", () => {
    const query = parseDeckListQuery({ folder: "none", colors: "UR" });
    expect(deckListQueryToParams(query)).toEqual({
      folder: "none",
      colors: "UR",
    });
    expect(deckListQueryToParams({ ...query, folder: { id: FOLDER } })).toEqual(
      { folder: FOLDER, colors: "UR" },
    );
  });
});

describe("tri et filtres de « Mes decks »", () => {
  const decks = [
    deck("Krenko", {
      colorIdentity: 8,
      priceEur: 180,
      folderId: FOLDER,
      status: "playable",
      updatedAt: new Date("2026-10-05"),
    }),
    deck("Atraxa", {
      colorIdentity: 1 | 2 | 4 | 16,
      priceEur: 400,
      favorite: true,
      createdAt: new Date("2026-09-10"),
    }),
    deck("Giada", {
      colorIdentity: 1,
      valid: false,
      priceEur: 50,
      commanders: [{ name: "Giada, Font of Hope" }],
      updatedAt: new Date("2026-10-09"),
    }),
    deck("Karn", { colorIdentity: 0, commanders: [] }),
  ];
  const query = parseDeckListQuery({});

  it("met les favoris en tête, puis suit le tri demandé", () => {
    expect(names(selectDecks(decks, query))).toEqual([
      "Atraxa",
      "Giada",
      "Krenko",
      "Karn",
    ]);
    expect(names(selectDecks(decks, { ...query, sort: "price" }))).toEqual([
      "Atraxa",
      "Krenko",
      "Giada",
      "Karn",
    ]);
    // Monocolores (WUBRG), puis multicolores, incolores en dernier.
    expect(names(selectDecks(decks, { ...query, sort: "color" }))).toEqual([
      "Atraxa",
      "Giada",
      "Krenko",
      "Karn",
    ]);
    // Sans commandant, en dernier.
    expect(names(selectDecks(decks, { ...query, sort: "commander" }))).toEqual([
      "Atraxa",
      "Giada",
      "Krenko",
      "Karn",
    ]);
    expect(names(selectDecks(decks, { ...query, sort: "created" }))).toEqual([
      "Atraxa",
      "Giada",
      "Karn",
      "Krenko",
    ]);
  });

  it("filtre par dossier, recherche, couleurs, statut et validité", () => {
    expect(
      names(selectDecks(decks, { ...query, folder: { id: FOLDER } })),
    ).toEqual(["Krenko"]);
    expect(names(selectDecks(decks, { ...query, folder: "none" }))).toEqual([
      "Atraxa",
      "Giada",
      "Karn",
    ]);
    expect(
      names(selectDecks(decks, { ...query, folder: "favorites" })),
    ).toEqual(["Atraxa"]);
    // Le nom du commandant compte aussi, sans accents ni casse.
    expect(names(selectDecks(decks, { ...query, q: "FONT of" }))).toEqual([
      "Giada",
    ]);
    expect(names(selectDecks(decks, { ...query, colors: ["W"] }))).toEqual([
      "Atraxa",
      "Giada",
    ]);
    expect(names(selectDecks(decks, { ...query, status: "playable" }))).toEqual(
      ["Krenko"],
    );
    expect(
      names(selectDecks(decks, { ...query, validity: "invalid" })),
    ).toEqual(["Giada"]);
    expect(
      names(
        selectDecks(
          decks,
          { ...query, validity: "invalid" },
          { ignoreStatus: true },
        ),
      ),
    ).toHaveLength(4);
  });
});
