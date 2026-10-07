import type * as OpenCv from "@techstark/opencv-js";
import {
  isCardShaped,
  orderCorners,
  type Point,
  type Quad,
} from "@/domain/scan/card-quad";
import { CARD_ASPECT, nameBand } from "@/domain/scan/frame";

type Cv = typeof OpenCv;

declare global {
  interface Window {
    cv?: Cv;
  }
}

/** Détecteur du contour des cartes sur l'image de la caméra. */
export interface CardDetector {
  /** Contour de la carte la plus grande, en pixels de la vidéo, ou null. */
  detect(video: HTMLVideoElement): Quad | null;
  /**
   * Bande du nom de la carte, redressée (la perspective est corrigée) et en
   * niveaux de gris contrastés, prête pour la reconnaissance de caractères.
   */
  nameBand(video: HTMLVideoElement, quad: Quad): HTMLCanvasElement;
}

/** Largeur de l'image analysée pour trouver le contour : rapide, assez précis. */
const DETECT_WIDTH = 320;
/** Largeur de l'image d'où la bande du nom est extraite. */
const WARP_SOURCE_WIDTH = 1280;
/** Hauteur de la bande du nom envoyée à l'OCR, en pixels. */
const BAND_HEIGHT = 72;

/**
 * Charge OpenCV.js depuis le site lui-même (fichier copié dans public/opencv
 * par scripts/copy-ocr-assets.mts), une seule fois.
 */
// Enveloppé dans un objet : une promesse résolue avec le module lui-même
// attendrait sans fin (le module a une méthode `then`).
let loading: Promise<{ cv: Cv }> | null = null;
function loadOpenCv(): Promise<{ cv: Cv }> {
  loading ??= new Promise<void>((resolve, reject) => {
    if (window.cv) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "/opencv/opencv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OpenCV.js indisponible"));
    document.head.append(script);
  }).then(
    // Le module se prépare après le chargement du script : on surveille
    // l'arrivée de ses fonctions.
    () =>
      new Promise<{ cv: Cv }>((resolve, reject) => {
        const deadline = Date.now() + 60_000;
        const check = () => {
          const cv = window.cv as Cv | undefined;
          if (cv && typeof cv.Mat === "function") resolve({ cv });
          else if (Date.now() > deadline) {
            reject(new Error("OpenCV.js indisponible"));
          } else setTimeout(check, 50);
        };
        check();
      }),
  );
  return loading;
}

export async function createCardDetector(): Promise<CardDetector> {
  const { cv } = await loadOpenCv();
  const small = document.createElement("canvas");
  const source = document.createElement("canvas");
  const band = document.createElement("canvas");

  /** Contours à 4 coins, au format d'une carte, dans l'image réduite. */
  function findQuad(width: number, height: number): Quad | null {
    const image = cv.imread(small);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    try {
      cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      cv.Canny(gray, edges, 40, 120);
      // Referme les bords interrompus (reflets, coins arrondis).
      cv.dilate(edges, edges, kernel);
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );
      let best: Quad | null = null;
      let bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > bestArea) {
          const quad = approximateQuad(contour);
          if (quad && isCardShaped(quad, width * height)) {
            best = quad;
            bestArea = area;
          }
        }
        contour.delete();
      }
      return best;
    } finally {
      for (const mat of [image, gray, edges, contours, hierarchy, kernel]) {
        mat.delete();
      }
    }
  }

  /** Polygone à 4 coins convexe qui approche le contour, ou null. */
  function approximateQuad(contour: OpenCv.Mat): Quad | null {
    const perimeter = cv.arcLength(contour, true);
    for (const tolerance of [0.02, 0.04]) {
      const polygon = new cv.Mat();
      try {
        cv.approxPolyDP(contour, polygon, tolerance * perimeter, true);
        if (polygon.rows === 4 && cv.isContourConvex(polygon)) {
          const points: Point[] = [];
          for (let i = 0; i < 4; i++) {
            points.push({
              x: polygon.data32S[i * 2],
              y: polygon.data32S[i * 2 + 1],
            });
          }
          return orderCorners(points);
        }
      } finally {
        polygon.delete();
      }
    }
    return null;
  }

  return {
    detect(video) {
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight) return null;
      const scale = DETECT_WIDTH / videoWidth;
      small.width = DETECT_WIDTH;
      small.height = Math.round(videoHeight * scale);
      small
        .getContext("2d", { willReadFrequently: true })
        ?.drawImage(video, 0, 0, small.width, small.height);
      const quad = findQuad(small.width, small.height);
      return (
        quad && (quad.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad)
      );
    },

    nameBand(video, quad) {
      const { videoWidth, videoHeight } = video;
      const scale = Math.min(1, WARP_SOURCE_WIDTH / videoWidth);
      source.width = Math.round(videoWidth * scale);
      source.height = Math.round(videoHeight * scale);
      source
        .getContext("2d", { willReadFrequently: true })
        ?.drawImage(video, 0, 0, source.width, source.height);

      // Carte redressée de taille telle que la bande du nom fasse BAND_HEIGHT
      // pixels de haut ; seule la bande est calculée (décalage de la carte).
      const cardHeight =
        BAND_HEIGHT / nameBand({ x: 0, y: 0, width: 1, height: 1 }).height;
      const cardWidth = cardHeight * CARD_ASPECT;
      const area = nameBand({
        x: 0,
        y: 0,
        width: cardWidth,
        height: cardHeight,
      });
      band.width = Math.round(area.width);
      band.height = Math.round(area.height);

      const image = cv.imread(source);
      const warped = new cv.Mat();
      const from = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        quad.flatMap((p) => [p.x * scale, p.y * scale]),
      );
      const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
        -area.x,
        -area.y,
        cardWidth - area.x,
        -area.y,
        cardWidth - area.x,
        cardHeight - area.y,
        -area.x,
        cardHeight - area.y,
      ]);
      const transform = cv.getPerspectiveTransform(from, to);
      try {
        cv.warpPerspective(
          image,
          warped,
          transform,
          new cv.Size(band.width, band.height),
          cv.INTER_LINEAR,
          cv.BORDER_REPLICATE,
        );
        cv.cvtColor(warped, warped, cv.COLOR_RGBA2GRAY);
        cv.normalize(warped, warped, 0, 255, cv.NORM_MINMAX);
        cv.imshow(band, warped);
      } finally {
        for (const mat of [image, warped, from, to, transform]) mat.delete();
      }
      return band;
    },
  };
}
