import { z } from "zod";
import type { Printing } from "../cards/printing";
import { MAX_COLLECTION_QUANTITY } from "./schema";

/** Exemplaires d'une carte d'une même édition et finition. */
export interface PrintingCopies {
  printingId: string;
  foil: boolean;
  quantity: number;
}

/** Édition des exemplaires, telle que la collection l'affiche. */
export type CollectionPrinting = Pick<
  Printing,
  | "id"
  | "setCode"
  | "setName"
  | "collectorNumber"
  | "finishes"
  | "imageUris"
  | "priceEur"
  | "priceUsd"
  | "priceEurFoil"
  | "priceUsdFoil"
>;

/** Exemplaires précisés d'une carte, avec leur édition. */
export type PrintingSplit = (PrintingCopies & {
  printing: CollectionPrinting;
})[];

/** Nombre d'exemplaires d'une édition et d'une finition à garder. */
export const collectionPrintingSchema = z.object({
  oracleId: z.uuid(),
  printingId: z.uuid(),
  foil: z.boolean(),
  quantity: z.number().int().min(0).max(MAX_COLLECTION_QUANTITY),
});

export type CollectionPrintingChange = z.infer<typeof collectionPrintingSchema>;

/** Finitions brillantes de Scryfall (« etched » compris). */
const FOIL_FINISHES = ["foil", "etched"];

/** L'édition existe dans cette finition. */
export function hasFinish(
  printing: Pick<Printing, "finishes">,
  foil: boolean,
): boolean {
  return foil
    ? printing.finishes.some((finish) => FOIL_FINISHES.includes(finish))
    : printing.finishes.includes("nonfoil");
}

/** Exemplaires dont l'édition n'est pas précisée. */
export function unspecifiedCopies(
  owned: number,
  split: readonly Pick<PrintingCopies, "quantity">[],
): number {
  const specified = split.reduce((sum, copies) => sum + copies.quantity, 0);
  return Math.max(0, owned - specified);
}

const sameCopies =
  (a: Omit<PrintingCopies, "quantity">) =>
  (b: Omit<PrintingCopies, "quantity">) =>
    a.printingId === b.printingId && a.foil === b.foil;

/**
 * Quantité qu'une édition peut recevoir : avec les autres éditions, elle ne
 * dépasse jamais les exemplaires possédés.
 */
export function clampPrintingQuantity(
  wanted: number,
  owned: number,
  split: readonly PrintingCopies[],
  target: Omit<PrintingCopies, "quantity">,
): number {
  const others = split
    .filter((copies) => !sameCopies(target)(copies))
    .reduce((sum, copies) => sum + copies.quantity, 0);
  return Math.max(0, Math.min(wanted, owned - others));
}

/** Prix d'un exemplaire : celui de sa finition, sinon celui de l'autre. */
export function copyPrice(
  printing: Pick<
    Printing,
    "priceEur" | "priceUsd" | "priceEurFoil" | "priceUsdFoil"
  >,
  foil: boolean,
  currency: "EUR" | "USD",
): number | null {
  const [normal, shiny] =
    currency === "EUR"
      ? [printing.priceEur, printing.priceEurFoil]
      : [printing.priceUsd, printing.priceUsdFoil];
  return foil ? (shiny ?? normal) : (normal ?? shiny);
}

/**
 * Valeur des exemplaires d'une carte : chaque exemplaire précisé au prix de
 * son édition et de sa finition, les autres au prix de l'édition par défaut.
 * Un prix inconnu compte pour zéro.
 */
export function copiesValue(
  owned: number,
  defaultPrice: number | null,
  split: PrintingSplit,
  currency: "EUR" | "USD",
): number {
  const specified = split.reduce(
    (sum, copies) =>
      sum +
      (copyPrice(copies.printing, copies.foil, currency) ?? 0) *
        copies.quantity,
    0,
  );
  return specified + (defaultPrice ?? 0) * unspecifiedCopies(owned, split);
}
