import { z } from "zod";
import { MAX_IMPORT_NAMES } from "./import";

/** Noms de cartes envoyés au serveur pour être reconnus. */
export const importNamesSchema = z.object({
  names: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(MAX_IMPORT_NAMES),
});

export type ImportNames = z.infer<typeof importNamesSchema>;
