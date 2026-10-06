import { normalizeCardName } from "@/domain/cards/normalize";

/** Longueur minimale d'une lecture pour être comparée aux noms des cartes. */
export const MIN_SCANNED_NAME_LENGTH = 3;

/**
 * Nettoie le texte lu par la reconnaissance de caractères sur la bande du nom
 * d'une carte. La lecture contient souvent du bruit : bord du cadre lu comme
 * « | » ou « l », symboles de mana lus comme « @ » ou « 2G », lettres isolées.
 * On garde la ligne la plus longue, sans les signes parasites, puis on retire
 * les mots sans lettre et les lettres isolées aux deux bouts.
 */
export function cleanScannedName(raw: string): string {
  const line = raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .reduce(
      (longest, part) => (part.length > longest.length ? part : longest),
      "",
    );

  const words = line
    // Garde les lettres (accents compris), chiffres, apostrophes, tirets et virgules.
    .replace(/[^\p{L}\p{N}'’,\- ]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[-,'’]+|-+$/g, ""))
    .filter((word) => /\p{L}/u.test(word));

  // Les lettres isolées aux deux bouts sont presque toujours du bruit (bord
  // du cadre, symbole de mana) ; au milieu du nom, elles sont gardées.
  while (words.length > 1 && isNoise(words[0])) words.shift();
  while (words.length > 1 && isNoise(words[words.length - 1])) words.pop();

  const name = words.join(" ").replace(/,$/, "");
  return normalizeCardName(name).length >= MIN_SCANNED_NAME_LENGTH ? name : "";
}

function isNoise(word: string): boolean {
  // Une lettre seule est du bruit ; un mot fait de chiffres et de lettres de
  // couleur en majuscules (« 2G », « UU », « 1GWUB ») est un coût de mana.
  const letters = word.replace(/[^\p{L}]/gu, "");
  return letters.length <= 1 || /^[0-9WUBRGCX]{2,}$/.test(word);
}

/** Carte proposée pour une lecture, avec sa ressemblance (0 à 1). */
export interface ScanCandidate {
  oracleId: string;
  name: string;
  similarity: number;
}

/** Ressemblance minimale de la meilleure carte pour l'ajouter sans confirmation. */
export const CONFIDENT_SIMILARITY = 0.75;
/** En dessous, la meilleure carte peut l'être si elle devance nettement la suivante. */
export const LIKELY_SIMILARITY = 0.5;
export const CLEAR_LEAD = 0.2;

/**
 * Carte reconnue sans hésitation parmi les propositions (triées de la plus
 * ressemblante à la moins ressemblante), ou null s'il faut demander à
 * l'utilisateur de choisir.
 */
export function confidentMatch<T extends ScanCandidate>(
  candidates: readonly T[],
): T | null {
  const [best, second] = candidates;
  if (!best) return null;
  if (best.similarity >= CONFIDENT_SIMILARITY) return best;
  const lead = best.similarity - (second?.similarity ?? 0);
  return best.similarity >= LIKELY_SIMILARITY && lead >= CLEAR_LEAD
    ? best
    : null;
}
