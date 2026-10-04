import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valide les variables d'environnement ; lève une erreur si l'une est invalide. */
export function parseServerEnv(env: Record<string, string | undefined>) {
  return serverEnvSchema.parse(env);
}

let cachedEnv: ServerEnv | undefined;

/**
 * Variables d'environnement du serveur, validées au premier accès
 * (et non au build : l'image Docker est construite sans secrets).
 */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
