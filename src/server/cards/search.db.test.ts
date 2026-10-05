import { describe, expect, it } from "vitest";
import { maskToColors } from "@/domain/cards/colors";
import { parseCardSearch } from "@/domain/cards/search-query";
import {
  getCard,
  resolveCardNames,
  searchCards,
  suggestCardNames,
} from "./search";

// Tests sur une vraie base PostgreSQL remplie du jeu de test (172 cartes).
type Params = Record<string, string | string[]>;

const search = (params: Params) => searchCards(parseCardSearch(params));
const names = async (params: Params) =>
  (await search(params)).cards.map((card) => card.name);

describe("recherche par nom", () => {
  it("place la carte au nom exact en premier", async () => {
    expect((await names({ q: "sol ring" }))[0]).toBe("Sol Ring");
  });

  it("tolère les fautes de frappe", async () => {
    expect(await names({ q: "sol rign" })).toContain("Sol Ring");
    expect((await names({ q: "ligtning bolt" }))[0]).toBe("Lightning Bolt");
    expect((await names({ q: "counterspel" }))[0]).toBe("Counterspell");
  });

  it("ignore les accents, la casse et la ponctuation", async () => {
    expect((await names({ q: "jotun" }))[0]).toBe("Jötun Grunt");
    expect((await names({ q: "SEANCE" }))[0]).toBe("Séance");
    expect((await names({ q: "lim duls vault" }))[0]).toBe("Lim-Dûl's Vault");
    expect((await names({ q: "nazgul" }))[0]).toBe("Nazgûl");
  });

  it("classe par popularité les noms dont un mot commence par la saisie", async () => {
    expect(await names({ q: "tutor" })).toEqual([
      "Demonic Tutor",
      "Vampiric Tutor",
      "Enlightened Tutor",
    ]);
    expect((await names({ q: "lightning" })).slice(0, 2)).toEqual([
      "Lightning Greaves",
      "Lightning Bolt",
    ]);
  });

  it("trouve une carte par le nom de sa seconde face", async () => {
    expect(await names({ q: "prismatic bridge" })).toContain(
      "Esika, God of the Tree // The Prismatic Bridge",
    );
  });

  it("résiste aux caractères spéciaux", async () => {
    await expect(
      search({ q: `%_\\'"; drop table card; --` }),
    ).resolves.toBeDefined();
    await expect(search({ text: "100%_\\" })).resolves.toBeDefined();
  });
});

describe("filtres", () => {
  it("limite l'identité couleur aux couleurs choisies", async () => {
    const result = await search({ color: ["W", "U"] });
    expect(result.total).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.colorIdentity & ~(1 | 2), card.name).toBe(0);
    }
    // Les deux couleurs, chacune seule, et l'incolore sont bien proposés.
    const identities = new Set(
      result.cards.map((card) => maskToColors(card.colorIdentity).join("")),
    );
    expect([...identities]).toEqual(expect.arrayContaining(["", "W", "U"]));
    const found = result.cards.map((card) => card.name);
    expect(found).toContain("Sol Ring");
    expect(found).not.toContain("Atraxa, Praetors' Voice");
  });

  it("réserve « C » seul aux cartes incolores", async () => {
    const result = await search({ color: "C" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.cards.every((card) => card.colorIdentity === 0)).toBe(true);
  });

  it("filtre par type de carte", async () => {
    const result = await search({ type: ["Instant", "Sorcery"] });
    expect(result.total).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.typeLine, card.name).toMatch(/Instant|Sorcery/);
    }
  });

  it("filtre par valeur de mana", async () => {
    const result = await search({ mvMin: "2", mvMax: "3" });
    expect(result.total).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.manaValue).toBeGreaterThanOrEqual(2);
      expect(card.manaValue).toBeLessThanOrEqual(3);
    }
  });

  it("écarte les cartes non légales en Commander", async () => {
    expect(await names({ q: "mana crypt" })).toContain("Mana Crypt");
    expect(await names({ q: "mana crypt", legal: "1" })).not.toContain(
      "Mana Crypt",
    );
  });

  it("ne garde que les commandants possibles", async () => {
    const found = await names({ commander: "1" });
    expect(found).toEqual(
      expect.arrayContaining([
        "Atraxa, Praetors' Voice",
        "Parhelion II",
        "Teferi, Temporal Archmage",
      ]),
    );
    expect(found).not.toContain("Sol Ring");
  });

  it("ne garde que les Game Changers", async () => {
    const result = await search({ gc: "1" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.cards.every((card) => card.gameChanger)).toBe(true);
  });

  it("cherche dans le texte Oracle", async () => {
    const result = await search({ text: "each opponent" });
    expect(result.total).toBeGreaterThan(0);
    for (const { oracleId, name } of result.cards) {
      const card = await getCard(oracleId);
      expect(card?.oracleText?.toLowerCase(), name).toContain("each opponent");
    }
  });

  it("combine les filtres", async () => {
    const result = await search({ type: "Land", color: "G", legal: "1" });
    expect(result.total).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.typeLine).toContain("Land");
      expect(card.colorIdentity & ~16).toBe(0);
      expect(card.commanderLegality).toBe("legal");
    }
  });
});

describe("tri et pagination", () => {
  it("trie par popularité par défaut", async () => {
    expect((await names({})).slice(0, 3)).toEqual([
      "Sol Ring",
      "Command Tower",
      "Arcane Signet",
    ]);
  });

  it("trie par nom ou par valeur de mana", async () => {
    const byName = await names({ sort: "name" });
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const byManaValue = (await search({ sort: "manaValue" })).cards.map(
      (card) => card.manaValue,
    );
    expect(byManaValue).toEqual([...byManaValue].sort((a, b) => a - b));
  });

  it("découpe les résultats en pages de 60 cartes", async () => {
    const first = await search({});
    expect(first.total).toBe(172);
    expect(first.pageCount).toBe(3);
    expect(first.cards).toHaveLength(60);
    const last = await search({ page: "3" });
    expect(last.cards).toHaveLength(52);
    const firstIds = new Set(first.cards.map((card) => card.oracleId));
    expect(last.cards.some((card) => firstIds.has(card.oracleId))).toBe(false);
  });
});

describe("suggestions et fiche carte", () => {
  it("suggère des noms dès deux lettres", async () => {
    expect(await suggestCardNames("a")).toEqual([]);
    const suggestions = await suggestCardNames("atrax");
    expect(suggestions[0]?.name).toBe("Atraxa, Praetors' Voice");
  });

  it("renvoie la fiche complète d'une carte", async () => {
    const [delver] = (await search({ q: "delver of secrets" })).cards;
    const card = await getCard(delver.oracleId);
    expect(card?.faces.map((face) => face.name)).toEqual([
      "Delver of Secrets",
      "Insectile Aberration",
    ]);
    expect(card?.legalities.commander).toBe("legal");
  });

  it("renvoie null pour un identifiant inconnu", async () => {
    expect(await getCard("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("reconnaissance des noms importés", () => {
  const resolved = async (names: string[]) =>
    (await resolveCardNames(names)).map((result) => result.card?.name ?? null);

  it("reconnaît les noms exacts sans tenir compte des accents ni de la casse", async () => {
    expect(
      await resolved(["Sol Ring", "jotun grunt", "LIM-DUL'S VAULT"]),
    ).toEqual(["Sol Ring", "Jötun Grunt", "Lim-Dûl's Vault"]);
  });

  it("reconnaît les cartes doubles par leur nom complet ou leur face avant", async () => {
    expect(
      await resolved(["Fire // Ice", "Fire/Ice", "Delver of Secrets"]),
    ).toEqual([
      "Fire // Ice",
      "Fire // Ice",
      "Delver of Secrets // Insectile Aberration",
    ]);
  });

  it("propose des cartes au nom proche pour un nom inconnu", async () => {
    const [result] = await resolveCardNames(["Sol Rign"]);
    expect(result.card).toBeNull();
    expect(result.suggestions.map((card) => card.name)).toContain("Sol Ring");
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });

  it("ne prend pas un début de nom pour une carte", async () => {
    expect(await resolved(["Sol", "Delver"])).toEqual([null, null]);
  });
});
