import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { type DeckPlacement, MAX_DECK_FOLDERS } from "@/domain/deck/deck-list";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { deckFolders, decks } from "@/server/db/schema";

// Dossiers de « Mes decks » et rangement des decks. Chaque fonction ne lit ou
// n'écrit que les dossiers et les decks de l'utilisateur donné.

export interface DeckFolder {
  id: string;
  name: string;
}

export type FolderResult =
  | { ok: true; folder: DeckFolder }
  | { ok: false; error: "duplicate" | "tooMany" | "notFound" };

/** Dossiers de l'utilisateur, par nom. */
export async function listDeckFolders(userId: string): Promise<DeckFolder[]> {
  return getDb()
    .select({ id: deckFolders.id, name: deckFolders.name })
    .from(deckFolders)
    .where(eq(deckFolders.userId, userId))
    .orderBy(asc(deckFolders.name));
}

/** Crée un dossier ; deux dossiers ne peuvent pas porter le même nom. */
export async function createDeckFolder(
  userId: string,
  name: string,
): Promise<FolderResult> {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(deckFolders)
    .where(eq(deckFolders.userId, userId));
  if (total >= MAX_DECK_FOLDERS) return { ok: false, error: "tooMany" };
  try {
    const [folder] = await db
      .insert(deckFolders)
      .values({ userId, name })
      .returning({ id: deckFolders.id, name: deckFolders.name });
    return { ok: true, folder };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/** Renomme un dossier de l'utilisateur. */
export async function renameDeckFolder(
  userId: string,
  folderId: string,
  name: string,
): Promise<FolderResult> {
  try {
    const [folder] = await getDb()
      .update(deckFolders)
      .set({ name })
      .where(and(eq(deckFolders.id, folderId), eq(deckFolders.userId, userId)))
      .returning({ id: deckFolders.id, name: deckFolders.name });
    return folder ? { ok: true, folder } : { ok: false, error: "notFound" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/**
 * Supprime un dossier de l'utilisateur. Ses decks ne sont pas supprimés :
 * ils restent sans dossier (clé étrangère `on delete set null`).
 */
export async function deleteDeckFolder(
  userId: string,
  folderId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(deckFolders)
    .where(and(eq(deckFolders.id, folderId), eq(deckFolders.userId, userId)))
    .returning({ id: deckFolders.id });
  return deleted.length > 0;
}

/**
 * Range un deck de l'utilisateur dans un de ses dossiers (null : sans
 * dossier) et le met ou le retire des favoris. La date de modification du
 * deck ne change pas : son contenu reste le même.
 */
export async function placeDeck(
  userId: string,
  deckId: string,
  { folderId, favorite }: DeckPlacement,
): Promise<"ok" | "notFound" | "unknownFolder"> {
  const db = getDb();
  if (folderId) {
    const [folder] = await db
      .select({ id: deckFolders.id })
      .from(deckFolders)
      .where(and(eq(deckFolders.id, folderId), eq(deckFolders.userId, userId)))
      .limit(1);
    if (!folder) return "unknownFolder";
  }
  const updated = await db
    .update(decks)
    .set({
      ...(folderId !== undefined && { folderId }),
      ...(favorite !== undefined && { favorite }),
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .returning({ id: decks.id });
  return updated.length > 0 ? "ok" : "notFound";
}
