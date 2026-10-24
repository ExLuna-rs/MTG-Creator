import { z } from "zod";
import { MAX_IMPORT_NAMES } from "./import";

/** Noms de cartes envoyés au serveur pour être reconnus. */
export const importNamesSchema = z.object({
  names: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(MAX_IMPORT_NAMES),
  /** Éditions indiquées dans la liste (« (CMM) 410 »). */
  printings: z
    .array(
      z.object({
        set: z.string().regex(/^[a-z0-9]{2,6}$/i),
        collectorNumber: z.string().trim().min(1).max(12),
      }),
    )
    .max(MAX_IMPORT_NAMES)
    .optional(),
});

export type ImportNames = z.infer<typeof importNamesSchema>;
