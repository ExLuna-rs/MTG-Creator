import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_SYMBOL_CLASSES,
  symbolIcon,
  tokenizeSymbols,
} from "./symbols";
import { fixtureCards } from "./test-fixtures";

describe("tokenizeSymbols", () => {
  it("sépare le texte et les symboles", () => {
    expect(tokenizeSymbols("{T}: Add {C}{C}.")).toEqual([
      { kind: "symbol", symbol: "{T}" },
      { kind: "text", text: ": Add " },
      { kind: "symbol", symbol: "{C}" },
      { kind: "symbol", symbol: "{C}" },
      { kind: "text", text: "." },
    ]);
  });

  it("gère un texte sans symbole et une chaîne vide", () => {
    expect(tokenizeSymbols("Flying")).toEqual([
      { kind: "text", text: "Flying" },
    ]);
    expect(tokenizeSymbols("")).toEqual([]);
  });
});

describe("symbolIcon", () => {
  it.each([
    ["{W}", "ms-w"],
    ["{12}", "ms-12"],
    ["{X}", "ms-x"],
    ["{T}", "ms-tap"],
    ["{Q}", "ms-untap"],
    ["{W/U}", "ms-wu"],
    ["{2/B}", "ms-2b"],
    ["{C/G}", "ms-cg"],
    ["{B/P}", "ms-bp"],
    ["{G/U/P}", "ms-gup"],
    ["{½}", "ms-1-2"],
    ["{∞}", "ms-infinity"],
    ["{1000000}", "ms-1000000"],
  ])("%s → %s", (symbol, className) => {
    expect(symbolIcon(symbol)).toEqual({ className, half: false });
  });

  it("gère les demi-symboles", () => {
    expect(symbolIcon("{HW}")).toEqual({ className: "ms-w", half: true });
  });

  it("renvoie null pour un symbole inconnu", () => {
    expect(symbolIcon("{C/P}")).toBeNull();
    expect(symbolIcon("{BANANA}")).toBeNull();
  });

  it("n'utilise que des classes présentes dans la feuille de style", () => {
    const css = readFileSync("src/styles/mana.css", "utf8");
    for (const suffix of SUPPORTED_SYMBOL_CLASSES) {
      expect(css, suffix).toMatch(new RegExp(`\\.ms-${suffix}::?before`));
    }
  });

  it("a une icône pour les symboles du jeu de test", () => {
    const missing = new Set<string>();
    for (const card of fixtureCards().values()) {
      const texts = [
        card.mana_cost,
        card.oracle_text,
        ...(card.card_faces ?? []).flatMap((face) => [
          face.mana_cost,
          face.oracle_text,
        ]),
      ];
      for (const text of texts) {
        for (const token of tokenizeSymbols(text ?? "")) {
          if (token.kind === "symbol" && !symbolIcon(token.symbol)) {
            missing.add(token.symbol);
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
