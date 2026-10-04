import { describe, expect, it } from "vitest";
import { cardData } from "../deck/test-helpers";
import { canPair, hasPairingAbility, pairingAbilities } from "./partners";

type Fake = Parameters<typeof canPair>[0];

/** Carte inventée, pour les capacités absentes du jeu de test. */
function fake(name: string, typeLine: string, oracleText: string): Fake {
  const [left = "", right = ""] = typeLine.split("—");
  const words = left.trim().split(/\s+/);
  return {
    name,
    typeLine,
    oracleText,
    supertypes: words.filter((word) => word === "Legendary"),
    types: words.filter((word) => word !== "Legendary"),
    subtypes: right.trim().split(/\s+/).filter(Boolean),
  };
}

describe("capacités de paire de commandants", () => {
  it("reconnaît Partner sur des cartes réelles", () => {
    expect(pairingAbilities(cardData("Thrasios, Triton Hero")).partner).toBe(
      true,
    );
    expect(hasPairingAbility(cardData("Atraxa, Praetors' Voice"))).toBe(false);
  });

  it("reconnaît Choose a Background et les Backgrounds", () => {
    expect(
      pairingAbilities(cardData("Wilson, Refined Grizzly")).chooseABackground,
    ).toBe(true);
    expect(pairingAbilities(cardData("Guild Artisan")).background).toBe(true);
  });

  it("lit le nom de « Partner with » sans le rappel", () => {
    const pako = fake(
      "Pako, Arcane Retriever",
      "Legendary Creature — Elemental Dog",
      "Partner with Haldan, Avid Arcanist (When this creature enters, target player may put Haldan into their hand from their library, then shuffle.)\nHaste",
    );
    expect(pairingAbilities(pako)).toMatchObject({
      partner: false,
      partnerWith: "Haldan, Avid Arcanist",
    });
  });
});

describe("paires de commandants", () => {
  const thrasios = cardData("Thrasios, Triton Hero");
  const tymna = cardData("Tymna the Weaver");
  const wilson = cardData("Wilson, Refined Grizzly");
  const artisan = cardData("Guild Artisan");
  const atraxa = cardData("Atraxa, Praetors' Voice");

  it("accepte deux cartes Partner", () => {
    expect(canPair(thrasios, tymna)).toBe(true);
    expect(canPair(tymna, thrasios)).toBe(true);
  });

  it("refuse une carte sans capacité de paire", () => {
    expect(canPair(thrasios, atraxa)).toBe(false);
    expect(canPair(atraxa, artisan)).toBe(false);
  });

  it("accepte Choose a Background avec un Background, dans les deux sens", () => {
    expect(canPair(wilson, artisan)).toBe(true);
    expect(canPair(artisan, wilson)).toBe(true);
  });

  it("refuse Partner avec un Background, et deux Backgrounds", () => {
    expect(canPair(thrasios, artisan)).toBe(false);
    expect(canPair(artisan, artisan)).toBe(false);
  });

  it("refuse deux fois la même carte", () => {
    expect(canPair(thrasios, thrasios)).toBe(false);
  });

  it("n'accepte « Partner with » qu'avec la carte nommée", () => {
    const pako = fake(
      "Pako, Arcane Retriever",
      "Legendary Creature — Elemental Dog",
      "Partner with Haldan, Avid Arcanist (reminder)",
    );
    const haldan = fake(
      "Haldan, Avid Arcanist",
      "Legendary Creature — Human Wizard",
      "Partner with Pako, Arcane Retriever (reminder)",
    );
    expect(canPair(pako, haldan)).toBe(true);
    expect(canPair(pako, thrasios)).toBe(false);
  });

  it("n'accepte une variante de Partner qu'avec la même variante", () => {
    const survivorA = fake(
      "Aurelia, Survivor",
      "Legendary Creature — Human Survivor",
      "Partner—Survivors (You can have two commanders if both have this ability.)",
    );
    const survivorB = fake(
      "Bjorn, Survivor",
      "Legendary Creature — Human Survivor",
      "Partner—Survivors (You can have two commanders if both have this ability.)",
    );
    const fatherSon = fake(
      "Kratos, Father",
      "Legendary Creature — God Warrior",
      "Partner—Father & son",
    );
    expect(canPair(survivorA, survivorB)).toBe(true);
    expect(canPair(survivorA, fatherSon)).toBe(false);
    expect(canPair(survivorA, thrasios)).toBe(false);
  });

  it("accepte Friends forever entre elles", () => {
    const a = fake(
      "Cecily, Haunted Mage",
      "Legendary Creature — Human Wizard",
      "Friends forever (You can have two commanders if both have friends forever.)",
    );
    const b = fake(
      "Will, the Wise",
      "Legendary Creature — Human",
      "Friends forever",
    );
    expect(canPair(a, b)).toBe(true);
    expect(canPair(a, thrasios)).toBe(false);
  });

  it("accepte Doctor's companion avec un Docteur", () => {
    const companion = fake(
      "Rose Tyler",
      "Legendary Creature — Human",
      "Doctor's companion (You can have two commanders if the other is the Doctor.)",
    );
    const doctor = fake(
      "The Tenth Doctor",
      "Legendary Creature — Time Lord Doctor",
      "Allons-y!",
    );
    const notADoctor = fake(
      "The Master",
      "Legendary Creature — Time Lord Rogue",
      "",
    );
    expect(canPair(companion, doctor)).toBe(true);
    expect(canPair(doctor, companion)).toBe(true);
    expect(canPair(companion, notADoctor)).toBe(false);
  });
});
