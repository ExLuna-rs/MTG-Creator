/** Rectangle en pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Format d'une carte Magic : 63 × 88 mm. */
export const CARD_ASPECT = 63 / 88;

/**
 * Bande du nom sur une carte redressée (`card` : la carte entière, à plat) :
 * en haut, sans le coût de mana à droite. Les proportions viennent des cadres
 * modernes (depuis 2003), avec une marge pour un contour un peu imprécis.
 */
export function nameBand(card: Rect): Rect {
  return {
    x: card.x + card.width * 0.05,
    y: card.y + card.height * 0.03,
    width: card.width * 0.72,
    height: card.height * 0.085,
  };
}
