import { z } from "zod";

/** Nombre maximal d'exemplaires d'une carte dans une collection. */
export const MAX_COLLECTION_QUANTITY = 9999;

/** Ajout ou retrait d'exemplaires d'une carte de la collection. */
export const collectionChangeSchema = z.object({
  oracleId: z.uuid(),
  delta: z
    .number()
    .int()
    .min(-MAX_COLLECTION_QUANTITY)
    .max(MAX_COLLECTION_QUANTITY)
    .refine((delta) => delta !== 0),
});

export type CollectionChange = z.infer<typeof collectionChangeSchema>;

/** Carte scannée à ajouter à la collection. */
export const scannedCardSchema = z.object({ oracleId: z.uuid() });

/** Texte lu sur la bande du nom d'une carte. */
export const scanTextSchema = z.object({ text: z.string().max(200) });

/**
 * Jeton d'un téléphone relié par QR code : 32 octets aléatoires en base64url.
 */
export const scanTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
