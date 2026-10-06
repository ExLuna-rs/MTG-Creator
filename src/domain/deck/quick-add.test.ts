import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

describe("saisie de la recherche rapide", () => {
  it.each([
    ["sol ring", 1, "sol ring"],
    ["  12 island ", 12, "island"],
    ["12x Island", 12, "Island"],
    ["2 x forest", 2, "forest"],
    ["0 island", 1, "0 island"],
    ["1996 World Champion", 1, "1996 World Champion"],
    ["12", 1, "12"],
  ])("« %s »", (value, quantity, query) => {
    expect(parseQuickAdd(value)).toEqual({ quantity, query });
  });
});
