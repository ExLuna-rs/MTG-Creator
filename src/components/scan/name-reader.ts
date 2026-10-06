import { guideRect, nameBand } from "@/domain/scan/frame";

/** Lecteur du nom d'une carte sur l'image de la caméra. */
export interface NameReader {
  read(video: HTMLVideoElement): Promise<string>;
  terminate(): Promise<void>;
}

/** Hauteur de la bande du nom envoyée à l'OCR, en pixels. */
const BAND_HEIGHT = 72;

/**
 * Charge Tesseract.js (≈ 7 Mo la première fois, puis en cache) depuis le site
 * lui-même : fichiers copiés dans public/tesseract par scripts/copy-ocr-assets.mts.
 */
export async function createNameReader(): Promise<NameReader> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    workerBlobURL: false,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    preserve_interword_spaces: "1",
  });
  const canvas = document.createElement("canvas");

  return {
    async read(video) {
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight) return "";
      const band = nameBand(guideRect(videoWidth, videoHeight));
      const scale = BAND_HEIGHT / band.height;
      canvas.width = Math.round(band.width * scale);
      canvas.height = BAND_HEIGHT;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return "";
      context.drawImage(
        video,
        band.x,
        band.y,
        band.width,
        band.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      toHighContrastGray(context, canvas.width, canvas.height);
      const { data } = await worker.recognize(canvas);
      return data.text;
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/** Niveaux de gris, contraste étiré entre le pixel le plus sombre et le plus clair. */
function toHighContrastGray(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const value = ((data[i] - min) * 255) / range;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  context.putImageData(image, 0, 0);
}
