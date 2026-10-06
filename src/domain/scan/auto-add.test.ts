import { describe, expect, it } from "vitest";
import { type AutoAddState, INITIAL_AUTO_ADD, nextAutoAdd } from "./auto-add";

/** Enchaîne des lectures et renvoie les cartes ajoutées. */
function run(readings: (string | null)[]): string[] {
  let state: AutoAddState = INITIAL_AUTO_ADD;
  const added: string[] = [];
  for (const reading of readings) {
    const result = nextAutoAdd(state, reading);
    state = result.state;
    if (result.add) added.push(result.add);
  }
  return added;
}

describe("ajout automatique", () => {
  it("ajoute une carte reconnue sur deux lectures de suite", () => {
    expect(run(["a"])).toEqual([]);
    expect(run(["a", "a"])).toEqual(["a"]);
  });

  it("n'ajoute qu'une fois une carte qui reste dans le cadre", () => {
    expect(run(["a", "a", "a", "a"])).toEqual(["a"]);
  });

  it("ignore une lecture isolée", () => {
    expect(run(["a", "b", "a", null, "c"])).toEqual([]);
  });

  it("enchaîne les cartes différentes", () => {
    expect(run(["a", "a", "b", "b", "c", "c"])).toEqual(["a", "b", "c"]);
  });

  it("ajoute un deuxième exemplaire après que la carte a quitté le cadre", () => {
    expect(run(["a", "a", null, "a", "a"])).toEqual(["a", "a"]);
  });

  it("ne rajoute pas la carte après une mauvaise lecture isolée", () => {
    expect(run(["a", "a", "b", "a", "a"])).toEqual(["a"]);
  });
});
