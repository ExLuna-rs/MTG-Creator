/** Rectangle en pixels de l'image de la caméra. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Format d'une carte Magic : 63 × 88 mm. */
export const CARD_ASPECT = 63 / 88;

/** Part de l'image occupée par le cadre de visée, au plus. */
const GUIDE_HEIGHT = 0.85;
const GUIDE_WIDTH = 0.9;

/**
 * Cadre de visée, au format d'une carte, centré dans l'image de la caméra.
 * Le même cadre est dessiné à l'écran (en pourcentages de l'image).
 */
export function guideRect(width: number, height: number): Rect {
  let guideHeight = height * GUIDE_HEIGHT;
  let guideWidth = guideHeight * CARD_ASPECT;
  if (guideWidth > width * GUIDE_WIDTH) {
    guideWidth = width * GUIDE_WIDTH;
    guideHeight = guideWidth / CARD_ASPECT;
  }
  return {
    x: (width - guideWidth) / 2,
    y: (height - guideHeight) / 2,
    width: guideWidth,
    height: guideHeight,
  };
}

/**
 * Bande du nom dans le cadre de visée : en haut de la carte, sans le coût de
 * mana à droite. Les proportions viennent des cadres modernes (depuis 2003),
 * avec une marge pour une carte un peu décalée dans le cadre.
 */
export function nameBand(guide: Rect): Rect {
  return {
    x: guide.x + guide.width * 0.05,
    y: guide.y + guide.height * 0.03,
    width: guide.width * 0.72,
    height: guide.height * 0.085,
  };
}
