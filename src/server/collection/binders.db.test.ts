import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import {
  createBinder,
  deleteBinder,
  getBinderSplits,
  listBinders,
  renameBinder,
  setBinderQuantity,
} from "./binders";
import { addCollectionCards, changeCollectionCard } from "./collection";

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
  return card.oracleId;
}

async function newBinder(userId: string, name: string): Promise<string> {
  const result = await createBinder(userId, name);
  if (!result.ok) throw new Error(result.error);
  return result.binder.id;
}

let owner: string;
let stranger: string;
let bolt: string;

beforeAll(async () => {
  owner = await newUser();
  stranger = await newUser();
  bolt = await oracleId("Lightning Bolt");
});

describe("classeurs", () => {
  it("crée, renomme, refuse un nom déjà pris et supprime", async () => {
    const red = await newBinder(owner, "Classeur rouge");
    expect(await createBinder(owner, "classeur ROUGE")).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect((await createBinder(stranger, "Classeur rouge")).ok).toBe(true);
    expect(await renameBinder(stranger, red, "Volé")).toEqual({
      ok: false,
      error: "notFound",
    });
    expect((await renameBinder(owner, red, "Rouge")).ok).toBe(true);
    expect(await listBinders(owner)).toEqual([{ id: red, name: "Rouge" }]);
    expect(await deleteBinder(stranger, red)).toBe(false);
    expect(await deleteBinder(owner, red)).toBe(true);
    expect(await listBinders(owner)).toEqual([]);
  });

  it("répartit les exemplaires sans dépasser ceux possédés", async () => {
    const user = await newUser();
    const red = await newBinder(user, "Rouge");
    const trade = await newBinder(user, "À échanger");
    await changeCollectionCard(user, bolt, 4);

    expect(await setBinderQuantity(user, red, bolt, 3)).toEqual({
      ok: true,
      quantity: 3,
    });
    // Il ne reste qu'un exemplaire non rangé.
    expect(await setBinderQuantity(user, trade, bolt, 2)).toEqual({
      ok: true,
      quantity: 1,
    });
    expect(await setBinderQuantity(stranger, red, bolt, 1)).toEqual({
      ok: false,
      error: "notFound",
    });
    expect((await getBinderSplits(user))[bolt]).toEqual({
      [red]: 3,
      [trade]: 1,
    });

    // Retirer des exemplaires vide d'abord le classeur créé en dernier.
    await changeCollectionCard(user, bolt, -2);
    expect((await getBinderSplits(user))[bolt]).toEqual({ [red]: 2 });
    await changeCollectionCard(user, bolt, -2);
    expect((await getBinderSplits(user))[bolt]).toBeUndefined();

    // Supprimer un classeur laisse ses cartes dans la collection, non rangées.
    await changeCollectionCard(user, bolt, 2);
    await setBinderQuantity(user, red, bolt, 2);
    await deleteBinder(user, red);
    expect(await getBinderSplits(user)).toEqual({});
  });

  it("range les cartes importées dans le classeur choisi", async () => {
    const user = await newUser();
    const red = await newBinder(user, "Rouge");
    const sol = await oracleId("Sol Ring");
    await changeCollectionCard(user, bolt, 1);
    expect(
      await addCollectionCards(
        user,
        [
          { oracleId: bolt, quantity: 2 },
          { oracleId: sol, quantity: 1 },
        ],
        red,
      ),
    ).toEqual({ cards: 2, copies: 3 });
    expect(await getBinderSplits(user)).toEqual({
      [bolt]: { [red]: 2 },
      [sol]: { [red]: 1 },
    });
    // Un classeur d'un autre utilisateur est refusé, et rien n'est ajouté.
    const other = await newBinder(stranger, "Autre");
    expect(
      await addCollectionCards(user, [{ oracleId: sol, quantity: 1 }], other),
    ).toBeNull();
  });
});
