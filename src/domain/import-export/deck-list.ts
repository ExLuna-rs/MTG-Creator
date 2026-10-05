import { type DeckZone, PRIMARY_TYPES } from "../deck/deck";

/** Longueur maximale du texte collé dans l'import. */
export const MAX_IMPORT_LENGTH = 50_000;

/** Longueur maximale d'une ligne de carte. */
const MAX_LINE_LENGTH = 200;

/** Une carte lue dans une liste texte. */
export interface DeckListLine {
  /** Numéro de la ligne dans le texte, à partir de 1. */
  line: number;
  /** Ligne d'origine, sans les espaces autour. */
  text: string;
  quantity: number;
  name: string;
  zone: DeckZone;
  categories: string[];
  /** Édition indiquée, par exemple « CMM » (ignorée jusqu'à la phase 5). */
  set: string | null;
  collectorNumber: string | null;
}

export interface ParsedDeckList {
  cards: DeckListLine[];
  /** Lignes qui ne ressemblent pas à une carte (quantité nulle, nom vide…). */
  invalid: { line: number; text: string }[];
}

/**
 * Titres de section reconnus (Moxfield, Archidekt, MTG Arena, MTGO). `null` :
 * section dont les lignes ne sont pas des cartes du deck (jetons, « About »
 * de MTG Arena).
 */
const SECTIONS: Record<string, DeckZone | null> = {
  commander: "commander",
  commanders: "commander",
  "command zone": "commander",
  deck: "main",
  main: "main",
  maindeck: "main",
  "main deck": "main",
  mainboard: "main",
  sideboard: "maybe",
  side: "maybe",
  maybe: "maybe",
  maybeboard: "maybe",
  considering: "maybe",
  companion: "maybe",
  companions: "maybe",
  tokens: null,
  token: null,
  about: null,
};

/** Catégories d'Archidekt qui désignent une zone plutôt qu'une catégorie. */
const ZONE_CATEGORIES: Record<string, DeckZone> = {
  commander: "commander",
  maybeboard: "maybe",
  sideboard: "maybe",
  considering: "maybe",
};

/** Types de carte : l'éditeur regroupe déjà par type, inutile d'en faire des catégories. */
const TYPE_CATEGORIES = new Set(
  PRIMARY_TYPES.flatMap((type) => {
    const lower = type.toLowerCase();
    return [lower, `${lower}s`];
  }),
);

/**
 * Titre de section : « Commander », « SIDEBOARD: », « // Sideboard »,
 * « Mainboard (99) »… Renvoie undefined si la ligne n'en est pas un.
 */
function sectionOf(text: string): DeckZone | null | undefined {
  const match = text.match(/^(?:\/\/|#)?\s*([a-z ]+?)\s*(?:\(\d+\))?\s*:?$/i);
  if (!match) return undefined;
  const key = match[1].toLowerCase();
  return key in SECTIONS ? SECTIONS[key] : undefined;
}

/**
 * Retire les annotations qui suivent le nom, dans n'importe quel ordre :
 * édition et numéro « (CMM) 410 », finition « *F* », catégories d'Archidekt
 * « [Ramp,Draw] » et étiquettes « ^Have,#37d67a^ ».
 */
function splitAnnotations(rest: string) {
  let name = rest;
  let set: string | null = null;
  let collectorNumber: string | null = null;
  const categories: string[] = [];

  const leadingSet = name.match(/^\[([a-z0-9]{2,6})\]\s+/i);
  if (leadingSet) {
    set = leadingSet[1].toUpperCase();
    name = name.slice(leadingSet[0].length);
  }

  for (;;) {
    const finish = name.match(/\s+\*[a-z]+\*$/i);
    const tags = name.match(/\s+\^[^^]*\^$/);
    const brackets = name.match(/\s+\[([^\]]*)\]$/);
    const edition = name.match(/\s+\(([a-z0-9]{2,6})\)(?:\s+([a-z0-9★-]+))?$/i);
    const found = finish ?? tags ?? brackets ?? edition;
    if (!found) break;
    if (found === brackets) {
      categories.unshift(...brackets[1].split(","));
    } else if (found === edition) {
      set = edition[1].toUpperCase();
      collectorNumber = edition[2] ?? null;
    }
    name = name.slice(0, -found[0].length);
  }

  return { name: name.trim(), set, collectorNumber, categories };
}

/**
 * Sépare les catégories d'Archidekt en zone (« Commander{top} »,
 * « Maybeboard ») et vraies catégories, sans les noms de types.
 */
function readCategories(raw: string[]): {
  zone: DeckZone | null;
  categories: string[];
} {
  let zone: DeckZone | null = null;
  const categories: string[] = [];
  for (const item of raw) {
    // « {top} », « {noDeck} »… : options d'affichage d'Archidekt.
    const category = item.replace(/\{[^}]*\}/g, "").trim();
    const key = category.toLowerCase();
    if (!category) continue;
    if (key in ZONE_CATEGORIES) {
      zone ??= ZONE_CATEGORIES[key];
    } else if (!TYPE_CATEGORIES.has(key)) {
      categories.push(category);
    }
  }
  return { zone, categories };
}

/**
 * Lit une liste de cartes au format texte, tel qu'exporté par Moxfield,
 * Archidekt, MTG Arena ou MTGO : une carte par ligne (« 1 Sol Ring »,
 * « 1x Sol Ring (CMM) 410 *F* [Ramp] »), avec des sections facultatives
 * (« Commander », « Deck », « Sideboard »…). Le sideboard et le maybeboard
 * vont dans les cartes à considérer ; les lignes vides et les commentaires
 * (« // … », « # … ») sont ignorés.
 */
export function parseDeckList(text: string): ParsedDeckList {
  const cards: DeckListLine[] = [];
  const invalid: ParsedDeckList["invalid"] = [];
  let section: DeckZone | null = "main";

  text
    .slice(0, MAX_IMPORT_LENGTH)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = index + 1;
      const trimmed = raw.trim();
      if (!trimmed) return;

      const header = sectionOf(trimmed);
      if (header !== undefined) {
        section = header;
        return;
      }
      if (trimmed.startsWith("//") || trimmed.startsWith("#")) return;
      if (section === null) return;

      const quantityMatch = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const parsed = splitAnnotations(
        quantityMatch ? quantityMatch[2] : trimmed,
      );
      if (
        trimmed.length > MAX_LINE_LENGTH ||
        quantity < 1 ||
        quantity > 999 ||
        // Un nom contient au moins une lettre : « 2 --- » n'est pas une carte.
        !/\p{L}/u.test(parsed.name)
      ) {
        invalid.push({ line, text: trimmed });
        return;
      }

      const { zone, categories } = readCategories(parsed.categories);
      cards.push({
        line,
        text: trimmed,
        quantity,
        name: parsed.name,
        zone: zone ?? section,
        categories,
        set: parsed.set,
        collectorNumber: parsed.collectorNumber,
      });
    });

  return { cards, invalid };
}
