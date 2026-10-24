import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type CollectionPrintingChange,
  clampPrintingQuantity,
  hasFinish,
  type PrintingCopies,
  type PrintingSplit,
} from "@/domain/collection/printings";
import { getDb } from "@/server/db";
import {
  collectionCards,
  collectionPrintings,
  printings,
} from "@/server/db/schema";
import type { DbExecutor } from "./collection";

// Édition et finition des exemplaires de la collection. Chaque fonction
// reçoit l'identifiant de l'utilisateur et ne lit ou n'écrit que sa propre
// collection.

const printingColumns = {
  id: printings.id,
  setCode: printings.setCode,
  setName: printings.setName,
  collectorNumber: printings.collectorNumber,
  finishes: printings.finishes,
  imageUris: printings.imageUris,
  priceEur: printings.priceEur,
  priceUsd: printings.priceUsd,
  priceEurFoil: printings.priceEurFoil,
  priceUsdFoil: printings.priceUsdFoil,
};

/**
 * Exemplaires précisés de chaque carte de la collection, par `oracle_id`,
 * des plus récemment précisés aux plus anciens. Une édition disparue de la
 * base n'est pas renvoyée : ses exemplaires comptent comme non précisés.
 */
export async function getPrintingSplits(
  userId: string,
): Promise<Record<string, PrintingSplit>> {
  const rows = await getDb()
    .select({
      oracleId: collectionPrintings.oracleId,
      printingId: collectionPrintings.printingId,
      foil: collectionPrintings.foil,
      quantity: collectionPrintings.quantity,
      printing: printingColumns,
    })
    .from(collectionPrintings)
    .innerJoin(printings, eq(printings.id, collectionPrintings.printingId))
    .where(eq(collectionPrintings.userId, userId))
    .orderBy(desc(collectionPrintings.updatedAt), printings.setCode);
  const splits: Record<string, PrintingSplit> = {};
  for (const { oracleId, ...copies } of rows) {
    splits[oracleId] ??= [];
    splits[oracleId].push(copies);
  }
  return splits;
}

/** Exemplaires possédés et exemplaires précisés d'une carte. */
async function readSplit(
  db: DbExecutor,
  userId: string,
  oracleId: string,
): Promise<{ owned: number; split: PrintingCopies[] }> {
  const [owned] = await db
    .select({ quantity: collectionCards.quantity })
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.userId, userId),
        eq(collectionCards.oracleId, oracleId),
      ),
    )
    .for("update");
  const split = await db
    .select({
      printingId: collectionPrintings.printingId,
      foil: collectionPrintings.foil,
      quantity: collectionPrintings.quantity,
    })
    .from(collectionPrintings)
    .where(
      and(
        eq(collectionPrintings.userId, userId),
        eq(collectionPrintings.oracleId, oracleId),
      ),
    )
    .orderBy(desc(collectionPrintings.updatedAt));
  return { owned: owned?.quantity ?? 0, split };
}

async function writeQuantity(
  db: DbExecutor,
  userId: string,
  oracleId: string,
  { printingId, foil, quantity }: PrintingCopies,
) {
  const key = and(
    eq(collectionPrintings.userId, userId),
    eq(collectionPrintings.printingId, printingId),
    eq(collectionPrintings.foil, foil),
  );
  if (quantity <= 0) {
    await db.delete(collectionPrintings).where(key);
    return;
  }
  await db
    .insert(collectionPrintings)
    .values({ userId, oracleId, printingId, foil, quantity })
    .onConflictDoUpdate({
      target: [
        collectionPrintings.userId,
        collectionPrintings.printingId,
        collectionPrintings.foil,
      ],
      set: { quantity, updatedAt: new Date() },
    });
}

export type SetPrintingQuantityResult =
  | { ok: true; quantity: number }
  | { ok: false; error: "unknownPrinting" };

/**
 * Précise l'édition et la finition de `quantity` exemplaires d'une carte de
 * la collection. Les exemplaires précisés ne dépassent jamais les
 * exemplaires possédés : la quantité est réduite si besoin. Renvoie la
 * quantité gardée.
 */
export async function setPrintingQuantity(
  userId: string,
  { oracleId, printingId, foil, quantity }: CollectionPrintingChange,
): Promise<SetPrintingQuantityResult> {
  const [printing] = await getDb()
    .select({ oracleId: printings.oracleId, finishes: printings.finishes })
    .from(printings)
    .where(eq(printings.id, printingId));
  // L'édition doit être une version de cette carte, dans cette finition
  // (on peut toujours retirer des exemplaires déjà précisés).
  if (
    !printing ||
    printing.oracleId !== oracleId ||
    (quantity > 0 && !hasFinish(printing, foil))
  ) {
    return { ok: false, error: "unknownPrinting" };
  }
  return getDb().transaction(async (tx) => {
    const { owned, split } = await readSplit(tx, userId, oracleId);
    const target = { printingId, foil };
    const kept = clampPrintingQuantity(quantity, owned, split, target);
    await writeQuantity(tx, userId, oracleId, { ...target, quantity: kept });
    return { ok: true, quantity: kept } as const;
  });
}

/**
 * Retire les exemplaires précisés qu'une carte n'a plus (exemplaires retirés
 * de la collection). Les éditions précisées en dernier partent en premier.
 */
export async function trimPrintingsToOwned(
  db: DbExecutor,
  userId: string,
  oracleId: string,
  owned: number,
): Promise<void> {
  const { split } = await readSplit(db, userId, oracleId);
  let excess = split.reduce((sum, copies) => sum + copies.quantity, 0) - owned;
  for (const copies of split) {
    if (excess <= 0) break;
    const removed = Math.min(copies.quantity, excess);
    excess -= removed;
    await writeQuantity(db, userId, oracleId, {
      ...copies,
      quantity: copies.quantity - removed,
    });
  }
}

/**
 * Précise l'édition d'exemplaires qui viennent d'être ajoutés à la
 * collection (import d'une liste). Les éditions inconnues, d'une autre
 * carte ou dans une finition qui n'existe pas sont ignorées : leurs
 * exemplaires restent non précisés.
 */
export async function addPrintingCopies(
  db: DbExecutor,
  userId: string,
  added: readonly (PrintingCopies & { oracleId: string })[],
): Promise<void> {
  if (added.length === 0) return;
  const known = new Map(
    (
      await db
        .select({
          id: printings.id,
          oracleId: printings.oracleId,
          finishes: printings.finishes,
        })
        .from(printings)
        .where(
          inArray(printings.id, [
            ...new Set(added.map((copies) => copies.printingId)),
          ]),
        )
    ).map((printing) => [printing.id, printing]),
  );
  const wanted = added.filter((copies) => {
    const printing = known.get(copies.printingId);
    return (
      printing?.oracleId === copies.oracleId && hasFinish(printing, copies.foil)
    );
  });
  for (const oracleId of new Set(wanted.map((copies) => copies.oracleId))) {
    const { owned, split } = await readSplit(db, userId, oracleId);
    for (const copies of wanted.filter((item) => item.oracleId === oracleId)) {
      const existing =
        split.find(
          (item) =>
            item.printingId === copies.printingId && item.foil === copies.foil,
        )?.quantity ?? 0;
      const kept = clampPrintingQuantity(
        existing + copies.quantity,
        owned,
        split,
        copies,
      );
      if (kept === existing) continue;
      await writeQuantity(db, userId, oracleId, { ...copies, quantity: kept });
      const index = split.findIndex(
        (item) =>
          item.printingId === copies.printingId && item.foil === copies.foil,
      );
      if (index >= 0) split[index] = { ...split[index], quantity: kept };
      else split.unshift({ ...copies, quantity: kept });
    }
  }
}
