/**
 * Saisie de la recherche rapide : « 12 island » ou « 12x island » donne une
 * quantité (99 au maximum) et le nom cherché ; sans nombre, un exemplaire.
 */
export function parseQuickAdd(value: string): {
  quantity: number;
  query: string;
} {
  const match = value.trim().match(/^(\d{1,2})\s*x?\s+(\S.*)$/i);
  if (!match || Number(match[1]) === 0) {
    return { quantity: 1, query: value.trim() };
  }
  return { quantity: Number(match[1]), query: match[2].trim() };
}
