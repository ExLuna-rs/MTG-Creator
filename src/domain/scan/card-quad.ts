/**
 * Contour d'une carte détecté sur l'image de la caméra : quatre coins, dans
 * l'ordre haut gauche, haut droit, bas droit, bas gauche (la carte debout).
 * Fonctions pures, sans OpenCV : ordre des coins, forme plausible d'une
 * carte, stabilité d'une image à l'autre.
 */
import { CARD_ASPECT } from "./frame";

export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point];

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Aire d'un polygone (formule du lacet). */
export function quadArea(quad: Quad): number {
  let twice = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/**
 * Range quatre points dans l'ordre des aiguilles d'une montre en partant du
 * haut gauche, puis tourne l'ordre pour que le côté du haut soit un petit
 * côté : la carte est lue debout, nom en haut.
 */
export function orderCorners(points: readonly Point[]): Quad {
  if (points.length !== 4) throw new Error("Un contour de carte a 4 coins.");
  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / 4,
    y: points.reduce((sum, p) => sum + p.y, 0) / 4,
  };
  // Sens des aiguilles d'une montre à l'écran (y vers le bas).
  const sorted = [...points].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) -
      Math.atan2(b.y - center.y, b.x - center.x),
  );
  // Départ : le coin le plus en haut à gauche.
  let start = 0;
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[start].x + sorted[start].y) {
      start = i;
    }
  }
  let quad = [0, 1, 2, 3].map((i) => sorted[(start + i) % 4]) as Quad;
  // Carte couchée : le côté du haut est un grand côté.
  if (distance(quad[0], quad[1]) > distance(quad[1], quad[2])) {
    // Le haut devient le petit côté le plus haut à l'écran.
    const left = [quad[3], quad[0]];
    const right = [quad[1], quad[2]];
    const leftY = (left[0].y + left[1].y) / 2;
    const rightY = (right[0].y + right[1].y) / 2;
    quad =
      leftY <= rightY
        ? [quad[3], quad[0], quad[1], quad[2]]
        : [quad[1], quad[2], quad[3], quad[0]];
  }
  return quad;
}

/** Largeur et hauteur moyennes du contour (la carte debout). */
export function quadSize(quad: Quad) {
  return {
    width: (distance(quad[0], quad[1]) + distance(quad[3], quad[2])) / 2,
    height: (distance(quad[0], quad[3]) + distance(quad[1], quad[2])) / 2,
  };
}

/** Part minimale de l'image occupée par une carte pour être lue. */
export const MIN_CARD_AREA = 0.06;
/** Écart toléré avec le format d'une carte (perspective comprise). */
export const ASPECT_TOLERANCE = 0.14;

/**
 * Vrai si le contour ressemble à une carte : assez grand dans l'image
 * (`frameArea`), au format 63 × 88 à la perspective près.
 */
export function isCardShaped(quad: Quad, frameArea: number): boolean {
  if (quadArea(quad) < frameArea * MIN_CARD_AREA) return false;
  const { width, height } = quadSize(quad);
  if (!height) return false;
  return Math.abs(width / height - CARD_ASPECT) <= ASPECT_TOLERANCE;
}

/**
 * Déplacement d'un contour à l'autre : le plus grand déplacement d'un coin,
 * rapporté à la diagonale de la carte.
 */
export function quadShift(a: Quad, b: Quad): number {
  const diagonal = distance(a[0], a[2]) || 1;
  return Math.max(...a.map((corner, i) => distance(corner, b[i]))) / diagonal;
}

/** En dessous de ce déplacement, la carte est immobile : on la lit. */
export const STEADY_SHIFT = 0.025;

/** Lissage du contour affiché : suit la carte sans trembler. */
export function smoothQuad(previous: Quad | null, next: Quad, weight = 0.5) {
  if (!previous || quadShift(previous, next) > 0.2) return next;
  return previous.map((corner, i) => ({
    x: corner.x + (next[i].x - corner.x) * weight,
    y: corner.y + (next[i].y - corner.y) * weight,
  })) as Quad;
}
