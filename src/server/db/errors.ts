import "server-only";

/**
 * Violation d'une contrainte d'unicité (code PostgreSQL 23505). Drizzle
 * enveloppe l'erreur du pilote : le code est sur elle ou sur sa cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; ) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
