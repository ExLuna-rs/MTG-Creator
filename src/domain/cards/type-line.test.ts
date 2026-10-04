import { describe, expect, it } from "vitest";
import { parseTypeLine } from "./type-line";

describe("parseTypeLine", () => {
  it("sépare surtypes, types et sous-types", () => {
    expect(parseTypeLine("Legendary Creature — Elf Druid")).toEqual({
      supertypes: ["Legendary"],
      types: ["Creature"],
      subtypes: ["Elf", "Druid"],
    });
  });

  it("gère les cartes sans sous-type", () => {
    expect(parseTypeLine("Basic Snow Land")).toEqual({
      supertypes: ["Basic", "Snow"],
      types: ["Land"],
      subtypes: [],
    });
  });

  it("réunit les types de toutes les faces, sans doublon", () => {
    expect(
      parseTypeLine("Creature — Human Wizard // Creature — Human Insect"),
    ).toEqual({
      supertypes: [],
      types: ["Creature"],
      subtypes: ["Human", "Wizard", "Insect"],
    });
    expect(parseTypeLine("Instant // Instant").types).toEqual(["Instant"]);
  });

  it("reconnaît les types multiples", () => {
    expect(parseTypeLine("Legendary Artifact — Vehicle").types).toEqual([
      "Artifact",
    ]);
    expect(parseTypeLine("Enchantment Creature — God").types).toEqual([
      "Enchantment",
      "Creature",
    ]);
  });
});
