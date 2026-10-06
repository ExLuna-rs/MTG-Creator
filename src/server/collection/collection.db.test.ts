import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import { changeCollectionCard, getCollection } from "./collection";
import {
  addScannedCard,
  createScanSession,
  deleteScanSession,
  findScanSession,
  getScanSessionStatus,
  matchScannedName,
  SCAN_SESSION_IDLE_MS,
  SCAN_SESSION_MAX_MS,
  type ScanActor,
  undoScannedCard,
} from "./scan";

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

const signedIn = (userId: string): ScanActor => ({
  userId,
  userName: "Test",
  scanSessionId: null,
});

let owner: string;
let stranger: string;

beforeAll(async () => {
  owner = await newUser();
  stranger = await newUser();
});

describe("collection", () => {
  it("ajoute et retire des exemplaires, puis retire la carte à zéro", async () => {
    const user = await newUser();
    const solRing = await oracleId("Sol Ring");
    expect(await changeCollectionCard(user, solRing, 2)).toEqual({
      ok: true,
      quantity: 2,
    });
    expect(await changeCollectionCard(user, solRing, 1)).toEqual({
      ok: true,
      quantity: 3,
    });
    expect(await changeCollectionCard(user, solRing, -1)).toEqual({
      ok: true,
      quantity: 2,
    });
    const collection = await getCollection(user);
    expect(collection.total).toBe(2);
    expect(collection.entries.map((entry) => entry.card.name)).toEqual([
      "Sol Ring",
    ]);

    expect(await changeCollectionCard(user, solRing, -5)).toEqual({
      ok: true,
      quantity: 0,
    });
    expect((await getCollection(user)).entries).toEqual([]);
  });

  it("refuse une carte inconnue", async () => {
    expect(await changeCollectionCard(owner, randomUUID(), 1)).toEqual({
      ok: false,
      error: "unknownCard",
    });
  });

  it("sépare les collections des utilisateurs", async () => {
    await changeCollectionCard(owner, await oracleId("Cultivate"), 1);
    expect(
      (await getCollection(stranger)).entries.map((entry) => entry.card.name),
    ).not.toContain("Cultivate");
  });
});

describe("liens de scan", () => {
  it("relie un téléphone par son jeton, jusqu'à expiration", async () => {
    const now = new Date();
    const { id, token } = await createScanSession(owner, now);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const actor = await findScanSession(token, now);
    expect(actor).toEqual({
      userId: owner,
      userName: "Test",
      scanSessionId: id,
    });
    expect(await findScanSession(`${token.slice(0, -1)}A`, now)).toBeNull();

    // Chaque utilisation repousse l'expiration, sans dépasser la durée maximale.
    const later = new Date(now.getTime() + SCAN_SESSION_IDLE_MS - 1000);
    expect(await findScanSession(token, later)).not.toBeNull();
    const tooLate = new Date(later.getTime() + SCAN_SESSION_IDLE_MS + 1000);
    expect(await findScanSession(token, tooLate)).toBeNull();
    const max = new Date(now.getTime() + SCAN_SESSION_MAX_MS + 1000);
    expect(await findScanSession(token, max)).toBeNull();
  });

  it("indique à l'ordinateur que le téléphone est connecté", async () => {
    const { id, token } = await createScanSession(owner);
    expect((await getScanSessionStatus(owner, id))?.connected).toBe(false);
    await findScanSession(token);
    expect((await getScanSessionStatus(owner, id))?.connected).toBe(true);
    // Le lien d'un autre utilisateur est introuvable.
    expect(await getScanSessionStatus(stranger, id)).toBeNull();
  });

  it("ne fonctionne plus une fois supprimé", async () => {
    const { id, token } = await createScanSession(owner);
    expect(await deleteScanSession(stranger, id)).toBe(false);
    expect(await deleteScanSession(owner, id)).toBe(true);
    expect(await findScanSession(token)).toBeNull();
  });

  it("garde au plus cinq liens par utilisateur", async () => {
    const user = await newUser();
    const tokens = [];
    for (let i = 0; i < 6; i++)
      tokens.push((await createScanSession(user)).token);
    expect(await findScanSession(tokens[0])).toBeNull();
    expect(await findScanSession(tokens[5])).not.toBeNull();
  });
});

describe("cartes scannées", () => {
  it("ajoute la carte à la collection et la montre à l'ordinateur", async () => {
    const user = await newUser();
    const { id, token } = await createScanSession(user);
    const phone = await findScanSession(token);
    if (!phone) throw new Error("Lien introuvable");
    const bolt = await oracleId("Lightning Bolt");

    const first = await addScannedCard(phone, bolt);
    const second = await addScannedCard(phone, bolt);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.quantity).toBe(2);
    expect(second.card.name).toBe("Lightning Bolt");

    const status = await getScanSessionStatus(user, id);
    expect(status?.cards.map((card) => card.id)).toEqual([
      first.card.id,
      second.card.id,
    ]);
    expect((await getCollection(user)).total).toBe(2);

    // Annuler retire un exemplaire.
    expect(await undoScannedCard(phone, second.card.id)).toBe(1);
    expect(await undoScannedCard(phone, second.card.id)).toBeNull();
    expect((await getCollection(user)).total).toBe(1);
    expect(
      (await getScanSessionStatus(user, id))?.cards.map((card) => card.id),
    ).toEqual([first.card.id]);
  });

  it("n'annule pas le scan d'un autre utilisateur ou d'un autre téléphone", async () => {
    const user = await newUser();
    const added = await addScannedCard(
      signedIn(user),
      await oracleId("Counterspell"),
    );
    if (!added.ok) throw new Error("Ajout refusé");
    expect(await undoScannedCard(signedIn(stranger), added.card.id)).toBeNull();

    const { token } = await createScanSession(user);
    const phone = await findScanSession(token);
    if (!phone) throw new Error("Lien introuvable");
    expect(await undoScannedCard(phone, added.card.id)).toBeNull();
    expect(await undoScannedCard(signedIn(user), added.card.id)).toBe(0);
  });

  it("refuse une carte inconnue", async () => {
    expect(await addScannedCard(signedIn(owner), randomUUID())).toEqual({
      ok: false,
      error: "unknownCard",
    });
  });
});

describe("reconnaissance du nom lu", () => {
  it.each([
    ["Sol Ring", "Sol Ring"],
    ["| Sol Rinq @", "Sol Ring"],
    ["Lightninq Bolt", "Lightning Bolt"],
    ["Counterspel1 UU", "Counterspell"],
    ["Delver of Secrets", "Delver of Secrets // Insectile Aberration"],
  ])("« %s » donne « %s »", async (text, expected) => {
    const [best] = await matchScannedName(text);
    expect(best?.name).toBe(expected);
    expect(best?.similarity).toBeGreaterThan(0.5);
  });

  it("ne propose rien pour une lecture vide", async () => {
    expect(await matchScannedName("| @ .")).toEqual([]);
  });
});
