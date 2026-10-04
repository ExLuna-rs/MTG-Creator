import { describe, expect, it } from "vitest";
import { normalizeCardName } from "./normalize";

describe("normalizeCardName", () => {
  it.each([
    ["Sol Ring", "sol ring"],
    ["Jötun Grunt", "jotun grunt"],
    ["Lim-Dûl's Vault", "lim duls vault"],
    ["Ifh-Bíff Efreet", "ifh biff efreet"],
    ["Æther Vial", "aether vial"],
    ["Fire // Ice", "fire ice"],
    ["Atraxa, Praetors' Voice", "atraxa praetors voice"],
    ["  Séance  ", "seance"],
  ])("« %s » devient « %s »", (input, expected) => {
    expect(normalizeCardName(input)).toBe(expected);
  });

  it("donne le même résultat pour la saisie et le nom stocké", () => {
    expect(normalizeCardName("LIM DUL'S vault")).toBe(
      normalizeCardName("Lim-Dûl's Vault"),
    );
  });
});
