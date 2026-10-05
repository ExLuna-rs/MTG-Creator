import { normalizeCardName } from "../cards/normalize";
import { type DeckCardData, type DeckEntry, isLand } from "./deck";

/**
 * Rôles d'une carte dans un deck Commander, dans l'ordre où le deck les
 * présente. Une carte peut en avoir plusieurs ; le premier de cette liste
 * sert au regroupement.
 */
export const CARD_ROLES = [
  "land",
  "ramp",
  "draw",
  "removal",
  "wipe",
  "counter",
  "tutor",
  "protection",
] as const;

export type CardRole = (typeof CARD_ROLES)[number];

/**
 * Ordre de priorité pour le rôle principal : une carte qui détruit tout et
 * fait piocher est d'abord une destruction de masse.
 */
const ROLE_PRECEDENCE: CardRole[] = [
  "land",
  "wipe",
  "removal",
  "counter",
  "ramp",
  "draw",
  "tutor",
  "protection",
];

/** Mots qui désignent un terrain dans une recherche de bibliothèque. */
const LAND_WORDS = /\b(?:lands?|forest|island|swamp|mountain|plains)\b/;

const NUMBER = "(?:a|an|one|two|three|four|five|six|seven|x|that many)";

/** Règles de détection, appliquées au texte Oracle en minuscules. */
const PATTERNS: Record<Exclude<CardRole, "land">, RegExp[]> = {
  ramp: [
    new RegExp(`\\bcreate ${NUMBER} treasure tokens?`),
    /\bput (?:a|up to \w+) land cards? from your hand onto the battlefield/,
  ],
  draw: [
    // « opponent draws » (Smothering Tithe) ne fait pas piocher son contrôleur.
    new RegExp(
      `(?<!opponent |controller may )\\bdraws? (?:up to )?${NUMBER} (?:additional )?cards?\\b`,
    ),
    /\bexile the top [^.]*of your library\. (?:until [^.]*, )?you may (?:play|cast)/,
  ],
  removal: [
    /\b(?:destroy|exile) (?:up to (?:one|two|three) )?target (?:[\w-]+ ){0,3}?(?:creature|artifact|enchantment|planeswalker|permanent|battle)s?\b(?! cards?\b)(?! you control)/,
    /\bdeals? (?:\d+|x) damage (?:to (?:any target|target (?:creature|planeswalker|attacking|blocking))|divided as you choose)/,
    /\btarget creature (?:an opponent controls )?gets -(?:\d+|x)\/-(?:\d+|x)/,
    /\breturn target (?:nonland )?(?:creature|permanent|artifact|enchantment|planeswalker)[^.]* to its owner's hand/,
    /\bowner of target (?:nonland )?permanent shuffles/,
    /\b(?:target player|target opponent|each opponent) sacrifices/,
    /\bfights? (?:up to one )?target creature/,
  ],
  wipe: [
    /\b(?:destroy|exile) (?:all|each) (?:[\w-]+,? ){0,4}?(?:creature|artifact|enchantment|planeswalker|permanent|nonland)/,
    /\ball (?:other )?creatures get -/,
    /\bdeals? (?:\d+|x) damage to each creature/,
    /\breturn all (?:nonland )?(?:permanents|creatures)/,
  ],
  counter: [/\bcounter target (?:[\w-]+,? ){0,4}?(?:spell|ability)/],
  tutor: [],
  protection: [
    /\b(?:gains?|have|has) (?:\w+ and )?(?:hexproof|indestructible|shroud|protection from)/,
    /\bphase out\b/,
    /\bchoose new targets for target spell/,
  ],
};

/** Texte Oracle sans texte de rappel, en minuscules. */
function cleanText(text: string | null): string {
  return (text ?? "").replace(/\([^)]*\)/g, "").toLowerCase();
}

/** Phrases qui cherchent dans sa propre bibliothèque. */
function librarySearches(text: string): string[] {
  return text
    .split(/[.\n]/)
    .filter((sentence) => sentence.includes("search your library for"));
}

/**
 * Rôles d'une carte déduits de son type et de son texte Oracle : terrain,
 * rampe (mana, Trésors, terrains cherchés), pioche, retrait ciblé,
 * destruction de masse, contresort, tuteur, protection. Ce n'est qu'une
 * estimation : l'utilisateur la corrige avec les catégories.
 */
export function detectRoles(
  card: Pick<DeckCardData, "typeLine" | "oracleText" | "producedMana">,
): CardRole[] {
  if (isLand(card)) return ["land"];
  const text = cleanText(card.oracleText);
  const roles = new Set<CardRole>();

  for (const [role, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      roles.add(role as CardRole);
    }
  }
  if (card.producedMana.length > 0 && /\badd\b/.test(text)) roles.add("ramp");
  for (const sentence of librarySearches(text)) {
    if (!LAND_WORDS.test(sentence)) roles.add("tutor");
    else if (sentence.includes("onto the battlefield")) roles.add("ramp");
  }
  // Surcharge (Cyclonic Rift, Vandalblast) : le retrait devient un balayage.
  if (roles.has("removal") && /\boverload\b/.test(text)) roles.add("wipe");

  return ROLE_PRECEDENCE.filter((role) => roles.has(role));
}

/**
 * Noms de catégories reconnus pour chaque rôle, en anglais (exports
 * d'Archidekt et de Moxfield) et en français, une fois normalisés.
 */
const ROLE_CATEGORY_NAMES: Record<CardRole, string[]> = {
  land: ["land", "lands", "terrain", "terrains"],
  ramp: ["ramp", "rampe", "mana", "mana rock", "mana rocks", "acceleration"],
  draw: ["draw", "card draw", "card advantage", "pioche", "avantage de cartes"],
  removal: [
    "removal",
    "spot removal",
    "targeted removal",
    "interaction",
    "retrait",
    "retraits",
  ],
  wipe: [
    "wipe",
    "wipes",
    "board wipe",
    "board wipes",
    "boardwipe",
    "sweeper",
    "sweepers",
    "mass removal",
    "destruction de masse",
  ],
  counter: [
    "counter",
    "counters",
    "counterspell",
    "counterspells",
    "contresort",
    "contresorts",
    "contre sort",
    "contre sorts",
  ],
  tutor: ["tutor", "tutors", "tuteur", "tuteurs"],
  protection: ["protection"],
};

const ROLE_BY_CATEGORY = new Map(
  Object.entries(ROLE_CATEGORY_NAMES).flatMap(([role, names]) =>
    names.map((name) => [name, role as CardRole] as const),
  ),
);

/** Rôle désigné par un nom de catégorie (« Rampe », « Board Wipe »), ou null. */
export function categoryRole(category: string): CardRole | null {
  return ROLE_BY_CATEGORY.get(normalizeCardName(category)) ?? null;
}

/**
 * Rôles retenus pour une ligne du deck : ceux que désignent ses catégories
 * si l'utilisateur en a choisi, sinon ceux déduits du texte de la carte.
 */
export function entryRoles(
  entry: Pick<DeckEntry, "categories"> & {
    card: Pick<DeckCardData, "typeLine" | "oracleText" | "producedMana">;
  },
): CardRole[] {
  const chosen = [
    ...new Set(
      entry.categories
        .map(categoryRole)
        .filter((role): role is CardRole => role !== null),
    ),
  ];
  return chosen.length > 0 ? chosen : detectRoles(entry.card);
}

/** Objectif d'un deck pour un rôle : nombre de cartes visé. */
export interface RoleGoal {
  role: CardRole;
  target: number;
}

/**
 * Objectifs par défaut d'un deck Commander, repris des recommandations
 * courantes (modèle de Command Zone, EDHREC) : 36 terrains, 10 rampes,
 * 10 pioches, 8 retraits ciblés et 3 destructions de masse.
 */
export const DEFAULT_GOALS: readonly RoleGoal[] = [
  { role: "land", target: 36 },
  { role: "ramp", target: 10 },
  { role: "draw", target: 10 },
  { role: "removal", target: 8 },
  { role: "wipe", target: 3 },
];

/**
 * Nombre de cartes du deck (quantités comprises, hors commandants et cartes
 * à considérer) pour chaque rôle. Une carte compte dans chacun de ses rôles.
 */
export function countRoles(
  deck: readonly (DeckEntry & { card: DeckCardData })[],
): Record<CardRole, number> {
  const counts = Object.fromEntries(
    CARD_ROLES.map((role) => [role, 0]),
  ) as Record<CardRole, number>;
  for (const entry of deck) {
    if (entry.zone !== "main") continue;
    for (const role of entryRoles(entry)) counts[role] += entry.quantity;
  }
  return counts;
}
