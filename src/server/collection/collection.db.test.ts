import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import { changeCollectionCard, getCollection } from "./collection";
import {
  addToScanList,
  commitScanList,
  createScanSession,
  deleteScanSession,
  findScanSession,
  getScanList,
  getScanSessionStatus,
  matchScannedName,
  SCAN_SESSION_IDLE_MS,
  SCAN_SESSION_MAX_MS,
  updateScanListItem,
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
    expect(collection.entries.map((entry) => entry.name)).toEqual(["Sol Ring"]);

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
      (await getCollection(stranger)).entries.map((entry) => entry.name),
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

describe("liste de scan", () => {
  it("regroupe les exemplaires et n'ajoute rien à la collection avant validation", async () => {
    const user = await newUser();
    const bolt = await oracleId("Lightning Bolt");
    const first = await addToScanList(user, bolt);
    const second = await addToScanList(user, bolt);
    expect(second?.id).toBe(first?.id);
    expect(second?.quantity).toBe(2);
    expect(second?.name).toBe("Lightning Bolt");
    expect(await addToScanList(user, randomUUID())).toBeNull();

    expect((await getCollection(user)).total).toBe(0);
    expect(await getScanList(stranger)).toEqual([]);
  });

  it("corrige une carte mal reconnue et sa quantité", async () => {
    const user = await newUser();
    const solRing = await oracleId("Sol Ring");
    const cultivate = await oracleId("Cultivate");
    const wrong = await addToScanList(user, await oracleId("Counterspell"));
    if (!wrong) throw new Error("Ajout refusé");

    // Autre carte et autre quantité.
    const fixed = await updateScanListItem(user, wrong.id, {
      oracleId: solRing,
      quantity: 3,
    });
    expect(fixed.ok && fixed.item?.name).toBe("Sol Ring");
    expect(fixed.ok && fixed.item?.quantity).toBe(3);

    // Une carte déjà dans la liste reçoit les exemplaires de la ligne corrigée.
    const other = await addToScanList(user, cultivate);
    if (!other || !fixed.ok || !fixed.item) throw new Error("Ajout refusé");
    const merged = await updateScanListItem(user, other.id, {
      oracleId: solRing,
    });
    expect(merged.ok && merged.item?.quantity).toBe(4);
    expect((await getScanList(user)).map((item) => item.name)).toEqual([
      "Sol Ring",
    ]);

    // L'utilisateur ne corrige que sa propre liste ; zéro retire la ligne.
    expect(
      await updateScanListItem(stranger, fixed.item.id, { quantity: 0 }),
    ).toEqual({ ok: false, error: "notFound" });
    expect(
      await updateScanListItem(user, fixed.item.id, { oracleId: randomUUID() }),
    ).toEqual({ ok: false, error: "unknownCard" });
    expect(
      await updateScanListItem(user, fixed.item.id, { quantity: 0 }),
    ).toEqual({ ok: true, item: null });
    expect(await getScanList(user)).toEqual([]);
  });

  it("ajoute toute la liste à la collection, puis la vide", async () => {
    const user = await newUser();
    const bolt = await oracleId("Lightning Bolt");
    await changeCollectionCard(user, bolt, 1);
    await addToScanList(user, bolt);
    await addToScanList(user, bolt);
    await addToScanList(user, await oracleId("Cultivate"));

    expect(await commitScanList(stranger)).toBe(0);
    expect(await commitScanList(user)).toBe(3);
    expect(await getScanList(user)).toEqual([]);
    const collection = await getCollection(user);
    expect(
      collection.entries.map((entry) => [entry.name, entry.quantity]),
    ).toEqual([
      ["Cultivate", 1],
      ["Lightning Bolt", 3],
    ]);
    expect(await commitScanList(user)).toBe(0);
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
