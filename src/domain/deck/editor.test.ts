import { describe, expect, it } from "vitest";
import {
  cleanCategories,
  createEditorState,
  type EditorAction,
  type EditorState,
  editorReducer,
  HISTORY_LIMIT,
} from "./editor";
import { cardData } from "./test-helpers";

const solRing = cardData("Sol Ring");
const island = cardData("Island");
const atraxa = cardData("Atraxa, Praetors' Voice");

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

const initial = () =>
  createEditorState(
    {
      name: "Atraxa",
      entries: [
        {
          oracleId: atraxa.oracleId,
          zone: "commander",
          quantity: 1,
          categories: [],
        },
      ],
    },
    [atraxa],
  );

const entry = (state: EditorState, oracleId: string, zone = "main") =>
  state.present.entries.find(
    (item) => item.oracleId === oracleId && item.zone === zone,
  );

describe("éditeur de deck", () => {
  it("ajoute une carte et garde ses données", () => {
    const state = run(initial(), { type: "add", card: solRing, zone: "main" });
    expect(entry(state, solRing.oracleId)).toEqual({
      oracleId: solRing.oracleId,
      zone: "main",
      quantity: 1,
      categories: [],
    });
    expect(state.cards[solRing.oracleId]).toBe(solRing);
  });

  it("n'ajoute pas un deuxième exemplaire d'une carte unique", () => {
    const once = run(initial(), { type: "add", card: solRing, zone: "main" });
    const twice = run(once, { type: "add", card: solRing, zone: "main" });
    expect(twice).toBe(once);
  });

  it("ajoute autant de terrains de base qu'on veut", () => {
    const add = { type: "add", card: island, zone: "main" } as const;
    const state = run(initial(), add, add, add);
    expect(entry(state, island.oracleId)?.quantity).toBe(3);
  });

  it("change la quantité, et retire la carte à zéro", () => {
    let state = run(
      initial(),
      { type: "add", card: island, zone: "main" },
      {
        type: "setQuantity",
        oracleId: island.oracleId,
        zone: "main",
        quantity: 30,
      },
    );
    expect(entry(state, island.oracleId)?.quantity).toBe(30);
    state = run(state, {
      type: "setQuantity",
      oracleId: island.oracleId,
      zone: "main",
      quantity: 0,
    });
    expect(entry(state, island.oracleId)).toBeUndefined();
  });

  it("déplace une carte vers les cartes à considérer et fusionne les quantités", () => {
    let state = run(
      initial(),
      { type: "add", card: island, zone: "main" },
      { type: "add", card: island, zone: "maybe" },
      { type: "move", oracleId: island.oracleId, from: "main", to: "maybe" },
    );
    expect(entry(state, island.oracleId)).toBeUndefined();
    expect(entry(state, island.oracleId, "maybe")?.quantity).toBe(2);

    state = run(state, {
      type: "move",
      oracleId: island.oracleId,
      from: "maybe",
      to: "commander",
    });
    expect(entry(state, island.oracleId, "commander")?.quantity).toBe(1);
  });

  it("gère les catégories et la catégorie principale", () => {
    let state = run(
      initial(),
      { type: "add", card: solRing, zone: "main" },
      {
        type: "setCategories",
        oracleId: solRing.oracleId,
        zone: "main",
        categories: [" Rampe ", "rampe", "", "Artefacts"],
      },
    );
    expect(entry(state, solRing.oracleId)?.categories).toEqual([
      "Rampe",
      "Artefacts",
    ]);

    state = run(state, {
      type: "setPrimaryCategory",
      oracleId: solRing.oracleId,
      zone: "main",
      category: "Artefacts",
    });
    expect(entry(state, solRing.oracleId)?.categories).toEqual([
      "Artefacts",
      "Rampe",
    ]);

    state = run(state, {
      type: "setPrimaryCategory",
      oracleId: solRing.oracleId,
      zone: "main",
      category: null,
    });
    expect(entry(state, solRing.oracleId)?.categories).toEqual(["Rampe"]);
  });

  it("annule et rétablit les modifications", () => {
    const added = run(initial(), { type: "add", card: solRing, zone: "main" });
    const renamed = run(added, { type: "rename", name: "Superfriends" });

    const undone = run(renamed, { type: "undo" });
    expect(undone.present.name).toBe("Atraxa");
    expect(entry(undone, solRing.oracleId)).toBeDefined();

    const undoneTwice = run(undone, { type: "undo" });
    expect(entry(undoneTwice, solRing.oracleId)).toBeUndefined();
    expect(run(undoneTwice, { type: "undo" })).toBe(undoneTwice);

    const redone = run(undoneTwice, { type: "redo" }, { type: "redo" });
    expect(redone.present).toEqual(renamed.present);
    expect(run(redone, { type: "redo" })).toBe(redone);
  });

  it("vide « Rétablir » après une nouvelle modification", () => {
    const state = run(
      initial(),
      { type: "add", card: solRing, zone: "main" },
      { type: "undo" },
      { type: "add", card: island, zone: "main" },
    );
    expect(state.future).toEqual([]);
  });

  it("ne garde qu'un nombre limité d'étapes", () => {
    let state = initial();
    for (let quantity = 1; quantity <= HISTORY_LIMIT + 20; quantity++) {
      state = run(state, { type: "rename", name: `Deck ${quantity}` });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it("n'ajoute rien à l'historique quand rien ne change", () => {
    const state = initial();
    expect(run(state, { type: "rename", name: "Atraxa" })).toBe(state);
    expect(
      run(state, { type: "remove", oracleId: solRing.oracleId, zone: "main" }),
    ).toBe(state);
  });
});

describe("nettoyage des catégories", () => {
  it("retire espaces, doublons et vides, et limite leur nombre", () => {
    expect(cleanCategories(["  Pioche  ", "pioche", " ", "A  B"])).toEqual([
      "Pioche",
      "A B",
    ]);
    expect(
      cleanCategories(Array.from({ length: 20 }, (_, i) => `C${i}`)),
    ).toHaveLength(10);
  });
});

describe("glisser-déposer", () => {
  it("change la zone et la catégorie en une seule étape", () => {
    const added = run(initial(), { type: "add", card: solRing, zone: "maybe" });
    const dropped = run(added, {
      type: "drop",
      oracleId: solRing.oracleId,
      from: "maybe",
      to: "main",
      category: "Rampe",
    });
    expect(entry(dropped, solRing.oracleId)?.categories).toEqual(["Rampe"]);
    expect(entry(dropped, solRing.oracleId, "maybe")).toBeUndefined();
    expect(dropped.past).toHaveLength(added.past.length + 1);
  });

  it("change seulement la catégorie dans la même zone", () => {
    const added = run(initial(), { type: "add", card: solRing, zone: "main" });
    const dropped = run(added, {
      type: "drop",
      oracleId: solRing.oracleId,
      from: "main",
      to: "main",
      category: "Rampe",
    });
    expect(entry(dropped, solRing.oracleId)?.categories).toEqual(["Rampe"]);
    expect(
      run(added, {
        type: "drop",
        oracleId: solRing.oracleId,
        from: "main",
        to: "main",
      }),
    ).toBe(added);
  });
});
