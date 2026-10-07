/** Lecture d'une image : carte absente, ou texte lu sur la bande du nom. */
export type Reading = { verdict: "empty" } | { verdict: "read"; text: string };

/** Lecteur du nom d'une carte sur la bande du nom, déjà redressée. */
export interface NameReader {
  read(band: HTMLCanvasElement): Promise<string>;
  terminate(): Promise<void>;
}

/**
 * Caractères des noms de cartes : limiter l'OCR à ces caractères accélère la
 * lecture et évite les signes parasites (symboles de mana, bord du cadre).
 */
const NAME_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÆæáàâäéèêëíîïóôöúûü' ,-";

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
    tessedit_char_whitelist: NAME_CHARACTERS,
  });

  return {
    async read(band) {
      const { data } = await worker.recognize(band);
      return data.text;
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
