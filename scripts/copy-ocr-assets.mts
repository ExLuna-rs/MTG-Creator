// Copie les fichiers de la reconnaissance de caractères (Tesseract.js) dans
// public/tesseract, et ceux de la détection des cartes (OpenCV.js) dans
// public/opencv : la page de scan les charge depuis le site lui-même, sans
// CDN externe. Lancé avant `next dev` et `next build` ; le dossier n'est pas
// versionné.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
// tesseract.js-core est une dépendance de tesseract.js, pas de l'application.
const coreDir = dirname(
  createRequire(join(tesseractDir, "package.json")).resolve(
    "tesseract.js-core/package.json",
  ),
);
const langDir = dirname(require.resolve("@tesseract.js-data/eng/package.json"));

const target = join(import.meta.dirname, "..", "public", "tesseract");
rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, "core"), { recursive: true });
mkdirSync(join(target, "lang"), { recursive: true });

copyFileSync(
  join(tesseractDir, "dist", "worker.min.js"),
  join(target, "worker.min.js"),
);
// Moteur LSTM seul (le plus précis) : une variante par niveau de prise en
// charge du SIMD par le navigateur, choisie par tesseract.js.
for (const file of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
]) {
  copyFileSync(join(coreDir, file), join(target, "core", file));
}
// Modèle anglais « best_int » : précis et léger (≈ 3 Mo).
copyFileSync(
  join(langDir, "4.0.0_best_int", "eng.traineddata.gz"),
  join(target, "lang", "eng.traineddata.gz"),
);

// Détection du contour des cartes (OpenCV.js, ≈ 11 Mo, chargé seulement
// quand la caméra démarre) : public/opencv, non versionné non plus.
const opencvTarget = join(import.meta.dirname, "..", "public", "opencv");
rmSync(opencvTarget, { recursive: true, force: true });
mkdirSync(opencvTarget, { recursive: true });
copyFileSync(
  require.resolve("@techstark/opencv-js"),
  join(opencvTarget, "opencv.js"),
);
