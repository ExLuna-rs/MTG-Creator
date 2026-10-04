// Génère src/styles/mana.css à partir de la feuille de style de mana-font,
// à relancer après une mise à jour du paquet : node scripts/generate-mana-css.mts
//
// On ne garde que la police « Mana » (licence SIL OFL 1.1). Le paquet contient
// aussi la police commerciale MPlantin, sans licence claire : elle est retirée,
// les quelques classes qui l'utilisent retombent sur Garamond, Palatino, etc.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("node_modules/mana-font/css/mana.css", "utf8");
const version = JSON.parse(
  readFileSync("node_modules/mana-font/package.json", "utf8"),
).version;

const fontFaces = [...source.matchAll(/@font-face\s*\{[^}]*\}/g)];
const manaFace = fontFaces.find((face) => face[0].includes('"Mana"'));
const plantinFace = fontFaces.find((face) => face[0].includes('"MPlantin"'));
if (!manaFace || !plantinFace) {
  throw new Error("Structure de mana.css inattendue : @font-face introuvable.");
}

const fontsDir = "../../node_modules/mana-font/fonts";
const css = source
  .replace(
    manaFace[0],
    `@font-face {
  font-family: "Mana";
  src: url("${fontsDir}/mana.woff2") format("woff2"), url("${fontsDir}/mana.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`,
  )
  .replace(plantinFace[0], "")
  .replace(/\/\*# sourceMappingURL=.*\*\/\s*$/, "");

writeFileSync(
  "src/styles/mana.css",
  `/* Généré par scripts/generate-mana-css.mts depuis mana-font ${version}.
 * Ne pas modifier à la main. CSS sous licence MIT, police Mana sous licence
 * SIL OFL 1.1, symboles © Wizards of the Coast. */
${css.trim()}
`,
);
console.log(`src/styles/mana.css généré (mana-font ${version}).`);
