import { z } from "zod";
import { DECK_ZONES } from "./deck";
import { MAX_CATEGORIES, MAX_QUANTITY } from "./editor";

/** Nombre maximal de lignes d'un deck (deck, commandants et à considérer). */
export const MAX_DECK_ENTRIES = 500;

export const deckNameSchema = z.string().trim().min(1).max(100);

export const categorySchema = z.string().trim().min(1).max(40);

export const deckEntrySchema = z.object({
  oracleId: z.uuid(),
  zone: z.enum(DECK_ZONES),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  categories: z.array(categorySchema).max(MAX_CATEGORIES),
});

/** Contenu d'un deck envoyé par la sauvegarde automatique de l'éditeur. */
export const deckSaveSchema = z
  .object({
    name: deckNameSchema,
    entries: z.array(deckEntrySchema).max(MAX_DECK_ENTRIES),
  })
  .superRefine(({ entries }, context) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const key = `${entry.zone}:${entry.oracleId}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Carte en double dans la même zone",
          path: ["entries", index],
        });
      }
      seen.add(key);
      if (entry.zone === "commander" && entry.quantity !== 1) {
        context.addIssue({
          code: "custom",
          message: "Un commandant n'a qu'un exemplaire",
          path: ["entries", index, "quantity"],
        });
      }
    });
  });

export type DeckSave = z.infer<typeof deckSaveSchema>;

/** Formulaire « Nouveau deck » : commandant, partenaire facultatif, nom. */
export const newDeckSchema = z
  .object({
    commanderId: z.uuid(),
    partnerId: z.uuid().optional(),
    name: z.string().trim().max(100).optional(),
  })
  .refine(({ commanderId, partnerId }) => commanderId !== partnerId, {
    path: ["partnerId"],
  });

export type NewDeck = z.infer<typeof newDeckSchema>;
