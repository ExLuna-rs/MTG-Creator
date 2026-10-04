/** Les cinq couleurs de Magic, dans l'ordre WUBRG. */
export const COLORS = ["W", "U", "B", "R", "G"] as const;

export type Color = (typeof COLORS)[number];

const COLOR_BITS: Record<Color, number> = { W: 1, U: 2, B: 4, R: 8, G: 16 };

export function isColor(value: string): value is Color {
  return (COLORS as readonly string[]).includes(value);
}

/**
 * Encode une liste de couleurs en masque de bits (W=1, U=2, B=4, R=8, G=16).
 * « Identité incluse dans X » s'écrit alors `(identité & ~X) = 0` en SQL.
 */
export function colorsToMask(colors: readonly string[]): number {
  let mask = 0;
  for (const color of colors) {
    if (isColor(color)) mask |= COLOR_BITS[color];
  }
  return mask;
}

export function maskToColors(mask: number): Color[] {
  return COLORS.filter((color) => (mask & COLOR_BITS[color]) !== 0);
}
