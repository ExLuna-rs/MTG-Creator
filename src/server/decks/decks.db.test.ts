import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listPrintings } from "@/server/cards/printings";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import {
  createDeck,
  deleteDeck,
  getOwnedDeck,
  listDecks,
  saveDeck,
} from "./decks";

// Tests sur une vraie base PostgreSQL remplie du jeu de test.

async function newUser(): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(users)
    .values({
      id,
      name: "Test",
      email: `${id}@example.com`,
      emailVerified: true,
    });
  return id;
}

const ids: Record<string, string> = {};

async function oracleId(name: string): Promise<string> {
  if (!ids[name]) {
    const [card] = await getDb()
      .select({ oracleId: cards.oracleId })
      .from(cards)
      .where(eq(cards.name, name));
    if (!card) throw new Error(`Carte absente : ${name}`);
    ids[name] = card.oracleId;
  }
  return ids[name];
}

let owner: string;
let stranger: string;

beforeAll(async () => {
  owner = await newUser();
  stranger = await newUser();
});

describe("création d'un deck", () => {
  it("crée le deck avec son commandant et le nom du commandant", async () => {
    const result = await createDeck(owner, {
      commanderId: await oracleId("Atraxa, Praetors' Voice"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const deck = await getOwnedDeck(owner, result.deckId);
    expect(deck?.name).toBe("Atraxa, Praetors' Voice");
    expect(deck?.entries).toEqual([
      {
        oracleId: await oracleId("Atraxa, Praetors' Voice"),
        zone: "commander",
        quantity: 1,
        categories: [],
      },
    ]);
  });

  it("accepte une paire valide et refuse les autres", async () => {
    const pair = await createDeck(owner, {
      commanderId: await oracleId("Wilson, Refined Grizzly"),
      partnerId: await oracleId("Guild Artisan"),
      name: "Ours",
    });
    expect(pair.ok).toBe(true);

    expect(
      await createDeck(owner, {
        commanderId: await oracleId("Atraxa, Praetors' Voice"),
        partnerId: await oracleId("Thrasios, Triton Hero"),
      }),
    ).toEqual({ ok: false, error: "invalidPair" });
    expect(
      await createDeck(owner, { commanderId: await oracleId("Sol Ring") }),
    ).toEqual({ ok: false, error: "notACommander" });
    expect(await createDeck(owner, { commanderId: randomUUID() })).toEqual({
      ok: false,
      error: "unknownCard",
    });
  });
});

describe("sauvegarde et lecture", () => {
  it("remplace les cartes, et seulement pour le propriétaire", async () => {
    const created = await createDeck(owner, {
      commanderId: await oracleId("Edgar Markov"),
    });
    if (!created.ok) throw new Error("création impossible");
    const entries = [
      {
        oracleId: await oracleId("Edgar Markov"),
        zone: "commander" as const,
        quantity: 1,
        categories: [],
      },
      {
        oracleId: await oracleId("Mountain"),
        zone: "main" as const,
        quantity: 99,
        categories: ["Terrains"],
      },
    ];

    const saved = await saveDeck(owner, created.deckId, {
      name: "Vampires",
      entries,
    });
    expect(saved.ok).toBe(true);
    const deck = await getOwnedDeck(owner, created.deckId);
    expect(deck?.name).toBe("Vampires");
    expect(deck?.entries).toHaveLength(2);
    expect(deck?.cards.map((card) => card.name).sort()).toEqual([
      "Edgar Markov",
      "Mountain",
    ]);

    // Un autre utilisateur ne peut ni lire, ni écrire, ni supprimer ce deck.
    expect(await getOwnedDeck(stranger, created.deckId)).toBeNull();
    expect(
      await saveDeck(stranger, created.deckId, { name: "Volé", entries: [] }),
    ).toEqual({ ok: false, error: "notFound" });
    expect(await deleteDeck(stranger, created.deckId)).toBe(false);
    expect((await getOwnedDeck(owner, created.deckId))?.entries).toHaveLength(
      2,
    );

    // Une carte inconnue est refusée.
    expect(
      await saveDeck(owner, created.deckId, {
        name: "Vampires",
        entries: [{ ...entries[0], oracleId: randomUUID() }],
      }),
    ).toEqual({ ok: false, error: "unknownCard" });

    const summaries = await listDecks(owner);
    const summary = summaries.find((item) => item.id === created.deckId);
    expect(summary).toMatchObject({
      name: "Vampires",
      cardCount: 100,
      valid: true,
      commanders: [expect.objectContaining({ name: "Edgar Markov" })],
    });
    // Le deck modifié en dernier arrive en premier.
    expect(summaries[0].id).toBe(created.deckId);
    expect(await listDecks(stranger)).toEqual([]);

    expect(await deleteDeck(owner, created.deckId)).toBe(true);
    expect(await getOwnedDeck(owner, created.deckId)).toBeNull();
  });
});

describe("édition des cartes d'un deck", () => {
  it("enregistre l'édition choisie et l'applique à l'illustration et au prix", async () => {
    const atraxa = await oracleId("Atraxa, Praetors' Voice");
    const solRing = await oracleId("Sol Ring");
    const created = await createDeck(owner, { commanderId: atraxa });
    if (!created.ok) throw new Error("deck non créé");
    const [atraxaPrinting] = (await listPrintings(atraxa)).slice(-1);
    const alpha = (await listPrintings(solRing)).find(
      (printing) => printing.setCode === "lea",
    );
    if (!alpha) throw new Error("édition Alpha absente");

    const saved = await saveDeck(owner, created.deckId, {
      name: "Atraxa",
      entries: [
        {
          oracleId: atraxa,
          zone: "commander",
          quantity: 1,
          categories: [],
          printingId: atraxaPrinting.id,
        },
        {
          oracleId: solRing,
          zone: "main",
          quantity: 1,
          categories: [],
          printingId: alpha.id,
        },
      ],
    });
    expect(saved.ok).toBe(true);

    const deck = await getOwnedDeck(owner, created.deckId);
    expect(
      deck?.entries.find((entry) => entry.oracleId === solRing)?.printingId,
    ).toBe(alpha.id);
    expect(deck?.printings.map((printing) => printing.id).sort()).toEqual(
      [alpha.id, atraxaPrinting.id].sort(),
    );

    const summary = (await listDecks(owner)).find(
      (item) => item.id === created.deckId,
    );
    expect(summary?.commanders[0].imageUris).toEqual(atraxaPrinting.imageUris);
    expect(summary?.priceEur).toBeGreaterThanOrEqual(alpha.priceEur ?? 0);
  });

  it("refuse l'édition d'une autre carte", async () => {
    const atraxa = await oracleId("Atraxa, Praetors' Voice");
    const created = await createDeck(owner, { commanderId: atraxa });
    if (!created.ok) throw new Error("deck non créé");
    const [solRingPrinting] = await listPrintings(await oracleId("Sol Ring"));
    const saved = await saveDeck(owner, created.deckId, {
      name: "Atraxa",
      entries: [
        {
          oracleId: atraxa,
          zone: "commander",
          quantity: 1,
          categories: [],
          printingId: solRingPrinting.id,
        },
      ],
    });
    expect(saved).toEqual({ ok: false, error: "unknownCard" });
  });
});
