import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  type BinderSplit,
  clampBinderQuantity,
  MAX_BINDERS,
} from "@/domain/collection/binders";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { binderCards, binders, collectionCards } from "@/server/db/schema";
import type { DbExecutor } from "./collection";

// Classeurs de la collection et exemplaires qu'ils contiennent. Chaque
// fonction ne lit ou n'écrit que les classeurs de l'utilisateur donné.

export interface Binder {
  id: string;
  name: string;
}

export type BinderResult =
  | { ok: true; binder: Binder }
  | { ok: false; error: "duplicate" | "tooMany" | "notFound" };

/** Classeurs de l'utilisateur, par nom. */
export async function listBinders(userId: string): Promise<Binder[]> {
  return getDb()
    .select({ id: binders.id, name: binders.name })
    .from(binders)
    .where(eq(binders.userId, userId))
    .orderBy(asc(binders.name));
}

/** Crée un classeur ; deux classeurs ne peuvent pas porter le même nom. */
export async function createBinder(
  userId: string,
  name: string,
): Promise<BinderResult> {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(binders)
    .where(eq(binders.userId, userId));
  if (total >= MAX_BINDERS) return { ok: false, error: "tooMany" };
  try {
    const [binder] = await db
      .insert(binders)
      .values({ userId, name })
      .returning({ id: binders.id, name: binders.name });
    return { ok: true, binder };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/** Renomme un classeur de l'utilisateur. */
export async function renameBinder(
  userId: string,
  binderId: string,
  name: string,
): Promise<BinderResult> {
  try {
    const [binder] = await getDb()
      .update(binders)
      .set({ name })
      .where(and(eq(binders.id, binderId), eq(binders.userId, userId)))
      .returning({ id: binders.id, name: binders.name });
    return binder ? { ok: true, binder } : { ok: false, error: "notFound" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/**
 * Supprime un classeur de l'utilisateur. Ses cartes restent dans la
 * collection, non rangées (les lignes du classeur partent en cascade).
 */
export async function deleteBinder(
  userId: string,
  binderId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(binders)
    .where(and(eq(binders.id, binderId), eq(binders.userId, userId)))
    .returning({ id: binders.id });
  return deleted.length > 0;
}

/** Exemplaires rangés de chaque carte de la collection, par classeur. */
export async function getBinderSplits(
  userId: string,
): Promise<Record<string, BinderSplit>> {
  const rows = await getDb()
    .select({
      binderId: binderCards.binderId,
      oracleId: binderCards.oracleId,
      quantity: binderCards.quantity,
    })
    .from(binderCards)
    .innerJoin(binders, eq(binders.id, binderCards.binderId))
    .where(eq(binders.userId, userId));
  const splits: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    splits[row.oracleId] ??= {};
    splits[row.oracleId][row.binderId] = row.quantity;
  }
  return splits;
}

async function readSplit(
  db: DbExecutor,
  userId: string,
  oracleId: string,
): Promise<{ owned: number; split: Record<string, number> }> {
  const [owned] = await db
    .select({ quantity: collectionCards.quantity })
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.userId, userId),
        eq(collectionCards.oracleId, oracleId),
      ),
    );
  const rows = await db
    .select({ binderId: binderCards.binderId, quantity: binderCards.quantity })
    .from(binderCards)
    .innerJoin(binders, eq(binders.id, binderCards.binderId))
    .where(and(eq(binders.userId, userId), eq(binderCards.oracleId, oracleId)))
    .orderBy(asc(binders.createdAt));
  return {
    owned: owned?.quantity ?? 0,
    split: Object.fromEntries(rows.map((row) => [row.binderId, row.quantity])),
  };
}

async function writeQuantity(
  db: DbExecutor,
  binderId: string,
  oracleId: string,
  quantity: number,
) {
  if (quantity <= 0) {
    await db
      .delete(binderCards)
      .where(
        and(
          eq(binderCards.binderId, binderId),
          eq(binderCards.oracleId, oracleId),
        ),
      );
    return;
  }
  await db
    .insert(binderCards)
    .values({ binderId, oracleId, quantity })
    .onConflictDoUpdate({
      target: [binderCards.binderId, binderCards.oracleId],
      set: { quantity },
    });
}

export type SetBinderQuantityResult =
  | { ok: true; quantity: number }
  | { ok: false; error: "notFound" };

/**
 * Range `quantity` exemplaires d'une carte dans un classeur de l'utilisateur.
 * Les classeurs ne contiennent jamais plus d'exemplaires que la collection :
 * la quantité est réduite si besoin. Renvoie la quantité rangée.
 */
export async function setBinderQuantity(
  userId: string,
  binderId: string,
  oracleId: string,
  quantity: number,
): Promise<SetBinderQuantityResult> {
  return getDb().transaction(async (tx) => {
    const [binder] = await tx
      .select({ id: binders.id })
      .from(binders)
      .where(and(eq(binders.id, binderId), eq(binders.userId, userId)))
      .for("update");
    if (!binder) return { ok: false, error: "notFound" };
    const { owned, split } = await readSplit(tx, userId, oracleId);
    const kept = clampBinderQuantity(quantity, owned, split, binderId);
    await writeQuantity(tx, binderId, oracleId, kept);
    return { ok: true, quantity: kept };
  });
}

/**
 * Retire des classeurs les exemplaires d'une carte que la collection ne
 * possède plus. Les classeurs créés en dernier se vident en premier.
 */
export async function trimBindersToOwned(
  db: DbExecutor,
  userId: string,
  oracleId: string,
  owned: number,
): Promise<void> {
  const { split } = await readSplit(db, userId, oracleId);
  let excess =
    Object.values(split).reduce((sum, copies) => sum + copies, 0) - owned;
  for (const [binderId, copies] of Object.entries(split).reverse()) {
    if (excess <= 0) break;
    const removed = Math.min(copies, excess);
    excess -= removed;
    await writeQuantity(db, binderId, oracleId, copies - removed);
  }
}

/** Le classeur existe et appartient à l'utilisateur. */
export async function ownsBinder(
  userId: string,
  binderId: string,
): Promise<boolean> {
  const [binder] = await getDb()
    .select({ id: binders.id })
    .from(binders)
    .where(and(eq(binders.id, binderId), eq(binders.userId, userId)));
  return binder !== undefined;
}

/**
 * Range dans un classeur de l'utilisateur (vérifié par `ownsBinder`) les
 * exemplaires qui viennent d'être ajoutés à la collection (import d'une
 * liste), sans dépasser les exemplaires possédés.
 */
export async function addToBinder(
  db: DbExecutor,
  userId: string,
  binderId: string,
  added: ReadonlyMap<string, number>,
): Promise<void> {
  if (added.size === 0) return;
  const oracleIds = [...added.keys()];
  const [owned, sorted] = await Promise.all([
    db
      .select({
        oracleId: collectionCards.oracleId,
        quantity: collectionCards.quantity,
      })
      .from(collectionCards)
      .where(
        and(
          eq(collectionCards.userId, userId),
          inArray(collectionCards.oracleId, oracleIds),
        ),
      ),
    db
      .select({
        oracleId: binderCards.oracleId,
        binderId: binderCards.binderId,
        quantity: binderCards.quantity,
      })
      .from(binderCards)
      .innerJoin(binders, eq(binders.id, binderCards.binderId))
      .where(
        and(
          eq(binders.userId, userId),
          inArray(binderCards.oracleId, oracleIds),
        ),
      ),
  ]);
  const splits = new Map<string, Record<string, number>>();
  for (const row of sorted) {
    const split = splits.get(row.oracleId) ?? {};
    split[row.binderId] = row.quantity;
    splits.set(row.oracleId, split);
  }
  const rows = owned.flatMap(({ oracleId, quantity }) => {
    const split = splits.get(oracleId) ?? {};
    const wanted = (split[binderId] ?? 0) + (added.get(oracleId) ?? 0);
    const kept = clampBinderQuantity(wanted, quantity, split, binderId);
    return kept > 0 ? [{ binderId, oracleId, quantity: kept }] : [];
  });
  if (rows.length > 0) {
    await db
      .insert(binderCards)
      .values(rows)
      .onConflictDoUpdate({
        target: [binderCards.binderId, binderCards.oracleId],
        set: { quantity: sql`excluded.quantity` },
      });
  }
}
