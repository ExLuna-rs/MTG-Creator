import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listPrintings } from "@/server/cards/printings";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import {
  addCollectionCards,
  changeCollectionCard,
  getCollection,
} from "./collection";
import { getPrintingSplits, setPrintingQuantity } from "./printings";

// Tests sur une vraie base PostgreSQL remplie du jeu de test (cartes et éditions).

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

async function printingOf(name: string, set: string) {
  const printing = (await listPrintings(await oracleId(name))).find(
    (item) => item.setCode === set,
  );
  if (!printing) throw new Error(`Édition absente : ${name} (${set})`);
  return printing;
}

let solRing: string;
let alpha: Awaited<ReturnType<typeof printingOf>>;

beforeAll(async () => {
  solRing = await oracleId("Sol Ring");
  alpha = await printingOf("Sol Ring", "lea");
});

describe("édition des exemplaires de la collection", () => {
  it("précise l'édition d'exemplaires, sans dépasser ceux possédés", async () => {
    const user = await newUser();
    await changeCollectionCard(user, solRing, 3);

    const change = { oracleId: solRing, printingId: alpha.id, foil: false };
    expect(await setPrintingQuantity(user, { ...change, quantity: 2 })).toEqual(
      { ok: true, quantity: 2 },
    );
    expect(await setPrintingQuantity(user, { ...change, quantity: 9 })).toEqual(
      { ok: true, quantity: 3 },
    );
    const splits = await getPrintingSplits(user);
    expect(splits[solRing]).toMatchObject([
      { printingId: alpha.id, foil: false, quantity: 3 },
    ]);
    expect(splits[solRing][0].printing.setCode).toBe("lea");
  });

  it("refuse une édition d'une autre carte ou une finition inexistante", async () => {
    const user = await newUser();
    await changeCollectionCard(user, await oracleId("Lightning Bolt"), 1);
    expect(
      await setPrintingQuantity(user, {
        oracleId: await oracleId("Lightning Bolt"),
        printingId: alpha.id,
        foil: false,
        quantity: 1,
      }),
    ).toEqual({ ok: false, error: "unknownPrinting" });
    // L'édition Alpha n'existe pas en brillant.
    expect(
      await setPrintingQuantity(user, {
        oracleId: solRing,
        printingId: alpha.id,
        foil: true,
        quantity: 1,
      }),
    ).toEqual({ ok: false, error: "unknownPrinting" });
  });

  it("retire les exemplaires précisés quand la collection en perd", async () => {
    const user = await newUser();
    await changeCollectionCard(user, solRing, 2);
    await setPrintingQuantity(user, {
      oracleId: solRing,
      printingId: alpha.id,
      foil: false,
      quantity: 2,
    });
    await changeCollectionCard(user, solRing, -1);
    expect((await getPrintingSplits(user))[solRing][0].quantity).toBe(1);
    await changeCollectionCard(user, solRing, -1);
    expect((await getPrintingSplits(user))[solRing]).toBeUndefined();
  });

  it("évalue la collection d'après l'édition de chaque exemplaire", async () => {
    const user = await newUser();
    await changeCollectionCard(user, solRing, 2);
    const before = await getCollection(user);
    await setPrintingQuantity(user, {
      oracleId: solRing,
      printingId: alpha.id,
      foil: false,
      quantity: 1,
    });
    const after = await getCollection(user);
    const defaultPrice = before.entries[0].priceEur ?? 0;
    expect(after.priceEur).toBeCloseTo(defaultPrice + (alpha.priceEur ?? 0));
  });

  it("garde l'édition des exemplaires importés", async () => {
    const user = await newUser();
    const bolt = await oracleId("Lightning Bolt");
    await addCollectionCards(user, [
      { oracleId: solRing, quantity: 1, printingId: alpha.id, foil: false },
      { oracleId: solRing, quantity: 2 },
      // Édition d'une autre carte : l'exemplaire reste sans édition.
      { oracleId: bolt, quantity: 1, printingId: alpha.id, foil: false },
    ]);
    const collection = await getCollection(user);
    expect(
      collection.entries.find((entry) => entry.oracleId === solRing)?.quantity,
    ).toBe(3);
    expect(collection.printings[solRing]).toMatchObject([
      { printingId: alpha.id, quantity: 1 },
    ]);
    expect(collection.printings[bolt]).toBeUndefined();
  });

  it("ne montre pas les éditions des autres utilisateurs", async () => {
    const user = await newUser();
    const other = await newUser();
    await changeCollectionCard(user, solRing, 1);
    await setPrintingQuantity(user, {
      oracleId: solRing,
      printingId: alpha.id,
      foil: false,
      quantity: 1,
    });
    expect(await getPrintingSplits(other)).toEqual({});
    // Sans exemplaire possédé, rien ne peut être précisé.
    expect(
      await setPrintingQuantity(other, {
        oracleId: solRing,
        printingId: alpha.id,
        foil: false,
        quantity: 1,
      }),
    ).toEqual({ ok: true, quantity: 0 });
  });
});
