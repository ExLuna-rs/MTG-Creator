import { z } from "zod";
import { MAX_COLLECTION_QUANTITY } from "./schema";

/** Au-delà, la colonne des classeurs deviendrait illisible. */
export const MAX_BINDERS = 100;
export const MAX_BINDER_NAME_LENGTH = 50;

export const binderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_BINDER_NAME_LENGTH);

/** Nombre d'exemplaires d'une carte à ranger dans un classeur. */
export const binderQuantitySchema = z.object({
  oracleId: z.uuid(),
  quantity: z.number().int().min(0).max(MAX_COLLECTION_QUANTITY),
});

/** Classeur affiché : toute la collection, les non rangés, ou un classeur. */
export type BinderView = "all" | "none" | { id: string };

/** Lit le paramètre `binder` de l'adresse ; une valeur invalide montre tout. */
export function parseBinderView(value: unknown): BinderView {
  if (value === "none") return "none";
  return typeof value === "string" && z.uuid().safeParse(value).success
    ? { id: value }
    : "all";
}

/** Exemplaires d'une carte par classeur. */
export type BinderSplit = Readonly<Record<string, number>>;

/** Exemplaires qui ne sont dans aucun classeur. */
export function unsortedCopies(owned: number, split: BinderSplit): number {
  const sorted = Object.values(split).reduce((sum, copies) => sum + copies, 0);
  return Math.max(0, owned - sorted);
}

/** Exemplaires d'une carte visibles dans une vue de la collection. */
export function copiesInView(
  owned: number,
  split: BinderSplit,
  view: BinderView,
): number {
  if (view === "all") return owned;
  if (view === "none") return unsortedCopies(owned, split);
  return split[view.id] ?? 0;
}

/**
 * Quantité qu'un classeur peut recevoir : les autres classeurs et lui ne
 * dépassent jamais les exemplaires possédés.
 */
export function clampBinderQuantity(
  wanted: number,
  owned: number,
  split: BinderSplit,
  binderId: string,
): number {
  const others = Object.entries(split).reduce(
    (sum, [id, copies]) => (id === binderId ? sum : sum + copies),
    0,
  );
  return Math.max(0, Math.min(wanted, owned - others));
}
