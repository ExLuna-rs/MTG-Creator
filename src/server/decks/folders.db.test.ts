import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { cards, users } from "@/server/db/schema";
import { createDeck, listDecks } from "./decks";
import {
  createDeckFolder,
  deleteDeckFolder,
  listDeckFolders,
  placeDeck,
  renameDeckFolder,
} from "./folders";

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

async function newDeck(userId: string): Promise<string> {
  const [card] = await getDb()
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(eq(cards.name, "Atraxa, Praetors' Voice"));
  const result = await createDeck(userId, { commanderId: card.oracleId });
  if (!result.ok) throw new Error(result.error);
  return result.deckId;
}

let owner: string;
let stranger: string;

beforeAll(async () => {
  owner = await newUser();
  stranger = await newUser();
});

describe("dossiers de decks", () => {
  it("crée, renomme et refuse un nom déjà pris (casse ignorée)", async () => {
    const created = await createDeckFolder(owner, "Multijoueur");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await createDeckFolder(owner, "multijoueur")).toEqual({
      ok: false,
      error: "duplicate",
    });
    // Un autre utilisateur peut avoir un dossier du même nom.
    expect((await createDeckFolder(stranger, "Multijoueur")).ok).toBe(true);

    const other = await createDeckFolder(owner, "Tests");
    if (!other.ok) throw new Error(other.error);
    expect(
      await renameDeckFolder(owner, other.folder.id, "MULTIJOUEUR"),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(await renameDeckFolder(stranger, other.folder.id, "Volé")).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await renameDeckFolder(owner, other.folder.id, "Duel")).toEqual({
      ok: true,
      folder: { id: other.folder.id, name: "Duel" },
    });
    expect((await listDeckFolders(owner)).map((folder) => folder.name)).toEqual(
      ["Duel", "Multijoueur"],
    );
  });

  it("range un deck et le met en favori, sans changer sa date", async () => {
    const deckId = await newDeck(owner);
    const folder = await createDeckFolder(owner, "Rangement");
    const foreign = await createDeckFolder(stranger, "Étranger");
    if (!folder.ok || !foreign.ok) throw new Error("dossier");
    const before = (await listDecks(owner)).find((deck) => deck.id === deckId);

    expect(
      await placeDeck(owner, deckId, {
        folderId: folder.folder.id,
        favorite: true,
      }),
    ).toBe("ok");
    // Ni le dossier d'un autre, ni le deck d'un autre.
    expect(
      await placeDeck(owner, deckId, { folderId: foreign.folder.id }),
    ).toBe("unknownFolder");
    expect(await placeDeck(stranger, deckId, { favorite: false })).toBe(
      "notFound",
    );

    const after = (await listDecks(owner)).find((deck) => deck.id === deckId);
    expect(after).toMatchObject({ folderId: folder.folder.id, favorite: true });
    expect(after?.updatedAt).toEqual(before?.updatedAt);

    // Supprimer le dossier garde le deck, sans dossier.
    expect(await deleteDeckFolder(stranger, folder.folder.id)).toBe(false);
    expect(await deleteDeckFolder(owner, folder.folder.id)).toBe(true);
    const orphan = (await listDecks(owner)).find((deck) => deck.id === deckId);
    expect(orphan).toMatchObject({ folderId: null, favorite: true });

    expect(await placeDeck(owner, deckId, { folderId: null })).toBe("ok");
  });
});
