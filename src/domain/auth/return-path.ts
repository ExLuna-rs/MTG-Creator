/**
 * Chemin où revenir après la connexion (paramètre `next`), sans la langue.
 * Seuls les chemins internes simples sont acceptés : un lien piégé ne peut
 * pas renvoyer l'utilisateur vers un autre site.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!/^\/[A-Za-z0-9\-_/]*$/.test(value) || value.startsWith("//")) {
    return "/";
  }
  return value;
}
