/**
 * Normalise un nom de carte pour la recherche : minuscules, sans accents ni
 * ponctuation. « Lim-Dûl's Vault » devient « lim duls vault ».
 * La même fonction s'applique aux noms stockés et aux recherches saisies.
 */
export function normalizeCardName(value: string): string {
  return value
    .replace(/[Ææ]/g, "ae")
    .replace(/[Œœ]/g, "oe")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
