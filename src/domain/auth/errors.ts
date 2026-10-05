// Traduction des erreurs renvoyées par Better Auth en clés de traduction
// (espace « AuthForm.errors »).

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotVerified"
  | "wrongPassword"
  | "passwordLength"
  | "invalidEmail"
  | "nameLength"
  | "invalidToken"
  | "tooManyRequests"
  | "sessionNotFresh"
  | "oauthFailed"
  | "oauthLinkFailed"
  | "unknown";

const ERROR_KEYS: Record<string, AuthErrorKey> = {
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  INVALID_PASSWORD: "wrongPassword",
  PASSWORD_TOO_SHORT: "passwordLength",
  PASSWORD_TOO_LONG: "passwordLength",
  INVALID_EMAIL: "invalidEmail",
  INVALID_NAME: "nameLength",
  INVALID_TOKEN: "invalidToken",
  TOKEN_EXPIRED: "invalidToken",
  // Suppression du compte sans mot de passe avec une session trop ancienne.
  SESSION_EXPIRED: "sessionNotFresh",
};

/** Clé de traduction d'une erreur de Better Auth (code et statut HTTP). */
export function authErrorKey(
  error: { code?: string; status?: number } | null | undefined,
): AuthErrorKey {
  if (!error) return "unknown";
  if (error.status === 429) return "tooManyRequests";
  return (error.code && ERROR_KEYS[error.code]) || "unknown";
}

/**
 * Clé de traduction d'une erreur de connexion avec Google (paramètre
 * `?error=` de la page de connexion), ou null s'il n'y en a pas.
 */
export function oauthErrorKey(error: unknown): AuthErrorKey | null {
  if (typeof error !== "string" || !error) return null;
  // Un compte existe avec cette adresse, mais elle n'est pas confirmée.
  if (error === "unable_to_link_account") return "oauthLinkFailed";
  return "oauthFailed";
}
