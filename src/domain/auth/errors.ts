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
};

/** Clé de traduction d'une erreur de Better Auth (code et statut HTTP). */
export function authErrorKey(
  error: { code?: string; status?: number } | null | undefined,
): AuthErrorKey {
  if (!error) return "unknown";
  if (error.status === 429) return "tooManyRequests";
  return (error.code && ERROR_KEYS[error.code]) || "unknown";
}
