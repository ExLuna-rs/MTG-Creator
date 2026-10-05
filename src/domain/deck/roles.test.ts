import { describe, expect, it } from "vitest";
import { categoryRole, detectRoles, entryRoles } from "./roles";
import { cardData, deckCard } from "./test-helpers";

const roles = (name: string) => detectRoles(cardData(name));

describe("rôles déduits du texte des cartes", () => {
  it.each([
    ["Command Tower", ["land"]],
    ["Urza's Saga", ["land"]],
    ["Myriad Landscape", ["land"]],
    ["Sol Ring", ["ramp"]],
    ["Arcane Signet", ["ramp"]],
    ["Elvish Mystic", ["ramp"]],
    ["Dark Ritual", ["ramp"]],
    ["Smothering Tithe", ["ramp"]],
    ["Dockside Extortionist", ["ramp"]],
    ["Cultivate", ["ramp"]],
    ["Farseek", ["ramp"]],
    ["Nature's Lore", ["ramp"]],
    ["Sakura-Tribe Elder", ["ramp"]],
    ["Primeval Titan", ["ramp"]],
    ["Solemn Simulacrum", ["ramp", "draw"]],
    ["Commander's Sphere", ["ramp", "draw"]],
    ["Jeska's Will", ["ramp", "draw"]],
    ["Rhystic Study", ["draw"]],
    ["Phyrexian Arena", ["draw"]],
    ["Brainstorm", ["draw"]],
    ["Skullclamp", ["draw"]],
    ["Esper Sentinel", ["draw"]],
    ["The One Ring", ["draw", "protection"]],
    ["Swords to Plowshares", ["removal"]],
    ["Path to Exile", ["removal"]],
    ["Beast Within", ["removal"]],
    ["Assassin's Trophy", ["removal"]],
    ["Feed the Swarm", ["removal"]],
    ["Lightning Bolt", ["removal"]],
    ["Dismember", ["removal"]],
    ["Chaos Warp", ["removal"]],
    ["Fire // Ice", ["removal", "draw"]],
    ["Toxic Deluge", ["wipe"]],
    ["Blasphemous Act", ["wipe"]],
    ["Cyclonic Rift", ["wipe", "removal"]],
    ["Vandalblast", ["wipe", "removal"]],
    ["Counterspell", ["counter"]],
    ["Swan Song", ["counter"]],
    ["Fierce Guardianship", ["counter"]],
    ["An Offer You Can't Refuse", ["counter"]],
    ["Arcane Denial", ["counter", "draw"]],
    ["Mana Drain", ["counter", "ramp"]],
    ["Demonic Tutor", ["tutor"]],
    ["Vampiric Tutor", ["tutor"]],
    ["Enlightened Tutor", ["tutor"]],
    ["Heroic Intervention", ["protection"]],
    ["Teferi's Protection", ["protection"]],
    ["Lightning Greaves", ["protection"]],
    ["Swiftfoot Boots", ["protection"]],
    ["Deflecting Swat", ["protection"]],
  ])("%s", (name, expected) => {
    expect(roles(name)).toEqual(expected);
  });

  it("ne donne aucun rôle aux cartes qui n'en ont pas", () => {
    expect(roles("Eternal Witness")).toEqual([]);
    expect(roles("Reanimate")).toEqual([]);
    expect(roles("Persistent Petitioners")).toEqual([]);
  });
});

describe("rôles désignés par les catégories", () => {
  it("reconnaît les noms anglais et français", () => {
    expect(categoryRole("Rampe")).toBe("ramp");
    expect(categoryRole("Board Wipe")).toBe("wipe");
    expect(categoryRole("destruction de masse")).toBe("wipe");
    expect(categoryRole("Contre-sorts")).toBe("counter");
    expect(categoryRole("Interaction")).toBe("removal");
    expect(categoryRole("Synergie")).toBeNull();
  });

  it("les catégories choisies remplacent les rôles déduits", () => {
    expect(entryRoles(deckCard("Sol Ring", { categories: ["Draw"] }))).toEqual([
      "draw",
    ]);
    // Une catégorie sans rôle reconnu laisse la déduction s'appliquer.
    expect(
      entryRoles(deckCard("Sol Ring", { categories: ["Synergie"] })),
    ).toEqual(["ramp"]);
  });
});
