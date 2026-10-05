import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

// Variable facultative : une valeur vide (`GOOGLE_CLIENT_ID=`) vaut absence.
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const authEnvSchema = z
  .object({
    // Clé de signature des cookies et des jetons (openssl rand -base64 32).
    BETTER_AUTH_SECRET: z.string().min(32),
    // Adresse publique du site : liens des emails, vérification de l'origine.
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    // Serveur d'envoi des emails, par exemple smtp://mailpit:1025 en
    // développement ou smtps://utilisateur:mot-de-passe@smtp.exemple.fr:465.
    SMTP_URL: z.url({ protocol: /^smtps?$/ }),
    MAIL_FROM: z.string().min(1).default("MTG Creator <no-reply@localhost>"),
    // Connexion avec Google (facultative) : identifiants OAuth créés dans la
    // console Google Cloud. Sans eux, le bouton Google n'apparaît pas.
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
  })
  .refine(
    (env) =>
      Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
    { message: "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble." },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Valide les variables d'environnement ; lève une erreur si l'une est invalide. */
export function parseServerEnv(env: Record<string, string | undefined>) {
  return serverEnvSchema.parse(env);
}

/** Valide les variables des comptes et des emails. */
export function parseAuthEnv(env: Record<string, string | undefined>) {
  return authEnvSchema.parse(env);
}

let cachedEnv: ServerEnv | undefined;
let cachedAuthEnv: AuthEnv | undefined;

/**
 * Variables d'environnement du serveur, validées au premier accès
 * (et non au build : l'image Docker est construite sans secrets).
 */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

/** Vrai si la connexion avec Google est configurée. */
export function isGoogleEnabled(): boolean {
  return Boolean(getAuthEnv().GOOGLE_CLIENT_ID);
}

/** Variables des comptes et des emails, validées au premier accès. */
export function getAuthEnv(): AuthEnv {
  cachedAuthEnv ??= parseAuthEnv(process.env);
  return cachedAuthEnv;
}
