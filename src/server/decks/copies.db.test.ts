import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { cardUsage } from "@/domain/collection/ownership";
import { changeCollectionCard } from "@/server/collection/collection";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import {
  getDeckHoldings,
  getDeckOwnership,
  setDeckAssembled,
  takeCopy,
} from "./copies";
import { createDeck, listDecks, saveDeck } from "./decks";

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

async function oracleId(name: string): Promise<string> {
  const [card] = await getDb()
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(eq(cards.name, name));
  if (!card) throw new Error(`Carte absente : ${name}`);
  return card.oracleId;
}

/** Deck d'Edgar Markov avec les cartes données (dans le deck). */
async function newDeck(userId: string, name: string, cardNames: string[]) {
  const commanderId = await oracleId("Edgar Markov");
  const created = await createDeck(userId, { commanderId, name });
  if (!created.ok) throw new Error("Deck non créé");
  const entries = [
    {
      oracleId: commanderId,
      zone: "commander" as const,
      quantity: 1,
      categories: [],
    },
    ...(await Promise.all(
      cardNames.map(async (cardName) => ({
        oracleId: await oracleId(cardName),
        zone: "main" as const,
        quantity: 1,
        categories: [],
      })),
    )),
  ];
  await saveDeck(userId, created.deckId, { name, entries });
  return { deckId: created.deckId, entries };
}

async function statusOf(userId: string, deckId: string) {
  return (await listDecks(userId)).find((deck) => deck.id === deckId);
}

let owner: string;
let stranger: string;
let solRing: string;
let signet: string;

beforeAll(async () => {
  owner = await newUser();
  stranger = await newUser();
  solRing = await oracleId("Sol Ring");
  signet = await oracleId("Arcane Signet");
});

describe("exemplaires physiques dans les decks", () => {
  it("monte un deck avec les exemplaires libres, puis les déplace", async () => {
    await changeCollectionCard(owner, solRing, 1);
    await changeCollectionCard(owner, signet, 2);
    await changeCollectionCard(owner, await oracleId("Edgar Markov"), 1);
    const first = await newDeck(owner, "Premier", [
      "Sol Ring",
      "Arcane Signet",
    ]);
    const second = await newDeck(owner, "Second", [
      "Sol Ring",
      "Arcane Signet",
    ]);

    // En construction : rien n'est rangé.
    expect(await statusOf(owner, first.deckId)).toMatchObject({
      status: "building",
      missingCopies: 0,
    });

    // Monté : le premier deck reçoit tout, il est jouable.
    expect(await setDeckAssembled(owner, first.deckId, true)).toBe(true);
    expect(await statusOf(owner, first.deckId)).toMatchObject({
      status: "playable",
    });

    // Le second ne reçoit que ce qui reste : il est construit.
    await setDeckAssembled(owner, second.deckId, true);
    expect(await statusOf(owner, second.deckId)).toMatchObject({
      status: "built",
      missingCopies: 2,
    });
    let holdings = await getDeckHoldings(owner);
    expect(cardUsage(solRing, 1, holdings)).toMatchObject({
      used: 1,
      free: 0,
      missing: 1,
      usedIn: [{ deckId: first.deckId, copies: 1 }],
    });

    // Plus d'exemplaire libre de Sol Ring : il faut le prendre au premier.
    expect(
      await takeCopy(owner, second.deckId, {
        oracleId: solRing,
        fromDeckId: null,
      }),
    ).toEqual({ ok: false, error: "unavailable" });
    expect(
      await takeCopy(owner, second.deckId, {
        oracleId: solRing,
        fromDeckId: first.deckId,
      }),
    ).toEqual({ ok: true });
    expect(await statusOf(owner, first.deckId)).toMatchObject({
      status: "built",
      missingCopies: 1,
    });
    holdings = await getDeckHoldings(owner);
    expect(cardUsage(solRing, 1, holdings).usedIn).toEqual([
      { deckId: second.deckId, copies: 1 },
    ]);

    // Un deck qui a déjà son exemplaire n'en prend pas un deuxième.
    expect(
      await takeCopy(owner, second.deckId, {
        oracleId: solRing,
        fromDeckId: first.deckId,
      }),
    ).toEqual({ ok: false, error: "notNeeded" });
  });

  it("rend les exemplaires quand le deck change ou repasse en construction", async () => {
    const userId = await newUser();
    await changeCollectionCard(userId, solRing, 1);
    const deck = await newDeck(userId, "Deck", ["Sol Ring"]);
    await setDeckAssembled(userId, deck.deckId, true);
    expect((await getDeckHoldings(userId))[0].copies[solRing]).toBe(1);

    // Sol Ring retiré du deck : son exemplaire redevient libre.
    await saveDeck(userId, deck.deckId, {
      name: "Deck",
      entries: deck.entries.slice(0, 1),
    });
    expect((await getDeckHoldings(userId))[0].copies[solRing]).toBeUndefined();

    // Remis puis deck repassé en construction : plus rien de rangé.
    await saveDeck(userId, deck.deckId, {
      name: "Deck",
      entries: deck.entries,
    });
    await setDeckAssembled(userId, deck.deckId, true);
    await setDeckAssembled(userId, deck.deckId, false);
    expect((await getDeckHoldings(userId))[0]).toMatchObject({
      assembled: false,
      copies: {},
    });
  });

  it("retire des decks les exemplaires sortis de la collection", async () => {
    const userId = await newUser();
    await changeCollectionCard(userId, solRing, 1);
    const deck = await newDeck(userId, "Deck", ["Sol Ring"]);
    await setDeckAssembled(userId, deck.deckId, true);
    await changeCollectionCard(userId, solRing, -1);
    expect((await getDeckHoldings(userId))[0].copies[solRing]).toBeUndefined();
  });

  it("refuse les decks d'un autre utilisateur", async () => {
    const theirs = await newDeck(owner, "Le mien", ["Sol Ring"]);
    const mine = await newDeck(stranger, "Autre", ["Sol Ring"]);
    expect(await setDeckAssembled(stranger, theirs.deckId, true)).toBe(false);
    expect(await getDeckOwnership(stranger, theirs.deckId)).toBeNull();
    expect(
      await takeCopy(stranger, theirs.deckId, {
        oracleId: solRing,
        fromDeckId: null,
      }),
    ).toEqual({ ok: false, error: "notFound" });
    // Prendre l'exemplaire du deck de quelqu'un d'autre est impossible.
    expect(
      await takeCopy(stranger, mine.deckId, {
        oracleId: solRing,
        fromDeckId: theirs.deckId,
      }),
    ).toEqual({ ok: false, error: "notFound" });
  });
});
