/**
 * Répartit des éléments en colonnes façon maçonnerie : chacun, dans l'ordre,
 * va dans la colonne la moins haute (la plus à gauche en cas d'égalité).
 * Les colonnes restent remplies sans trou, quelle que soit la hauteur des
 * éléments.
 */
export function masonry<T>(
  items: readonly T[],
  height: (item: T) => number,
  columnCount: number,
): T[][] {
  const count = Math.max(1, Math.floor(columnCount));
  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  for (const item of items) {
    const target = heights.indexOf(Math.min(...heights));
    columns[target].push(item);
    heights[target] += height(item);
  }
  return columns;
}
