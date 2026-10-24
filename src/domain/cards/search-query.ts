import { z } from "zod";
import { RARITIES } from "./card";
import { COLORS, type Color, isColor } from "./colors";
import { CARD_TYPES } from "./type-line";

/** Tris proposés ; « relevance » n'a de sens qu'avec une recherche par nom. */
export const CARD_SORTS = [
  "relevance",
  "popularity",
  "name",
  "manaValue",
  "priceEur",
  "priceUsd",
] as const;

export type CardSort = (typeof CARD_SORTS)[number];

/** Couleurs du filtre de couleurs ; « C » seul = cartes incolores uniquement. */
export const IDENTITY_FILTER_COLORS = [...COLORS, "C"] as const;

/**
 * Comparaison entre les couleurs choisies et celles de la carte :
 * « within » = jouable avec (comprises dans le choix, incolores comprises),
 * « exact » = exactement, « all » = toutes ces couleurs (au moins),
 * « any » = au moins une.
 */
export const COLOR_MODES = ["within", "exact", "all", "any"] as const;

export type ColorMode = (typeof COLOR_MODES)[number];

/** Couleurs comparées : identité couleur (règle Commander) ou couleur. */
export const COLOR_SOURCES = ["identity", "card"] as const;

export type ColorSource = (typeof COLOR_SOURCES)[number];

/** Plusieurs types et sous-types : au moins un (OU) ou tous (ET). */
export const TYPE_MODES = ["or", "and"] as const;

export type TypeMode = (typeof TYPE_MODES)[number];

/** Groupes de filtres, chacun retiré d'un coup dans les filtres actifs. */
export const FILTER_GROUPS = [
  "colors",
  "types",
  "manaValue",
  "rarities",
  "sets",
  "text",
  "commanderLegal",
  "canBeCommander",
  "gameChanger",
] as const;

export type FilterGroup = (typeof FILTER_GROUPS)[number];

export const MAX_SUBTYPES = 10;
const MAX_SUBTYPE_LENGTH = 40;
/** Lettres, chiffres, espaces, apostrophes et tirets (« Urza's », « Time Lord »). */
const SUBTYPE_PATTERN = /^[0-9A-Za-zÀ-ÖØ-öø-ÿ' ’.-]+$/;

export const MAX_SETS = 10;
/** Code d'extension de Scryfall : « cmm », « 2xm », « pkhm »… */
const SET_CODE_PATTERN = /^[a-z0-9]{2,6}$/;

export const CARD_PAGE_SIZE = 60;
const MAX_PAGE = 500;
const MAX_MANA_VALUE = 20;

export interface CardSearch {
  name: string;
  text: string;
  colors: (typeof IDENTITY_FILTER_COLORS)[number][];
  colorMode: ColorMode;
  colorSource: ColorSource;
  types: (typeof CARD_TYPES)[number][];
  /** Sous-types tels que saisis (comparés sans tenir compte de la casse). */
  subtypes: string[];
  typeMode: TypeMode;
  rarities: (typeof RARITIES)[number][];
  /** Codes d'extension : cartes imprimées au moins une fois dans l'une d'elles. */
  sets: string[];
  manaValueMin: number | null;
  manaValueMax: number | null;
  commanderLegal: boolean;
  canBeCommander: boolean;
  gameChanger: boolean;
  sort: CardSort;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function all(params: RawParams, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(params: RawParams, key: string): string {
  return all(params, key)[0] ?? "";
}

/** Garde les valeurs autorisées, sans doublon, dans l'ordre de la liste. */
function pick<T extends string>(allowed: readonly T[], values: string[]): T[] {
  return allowed.filter((item) => values.includes(item));
}

const textSchema = (max: number) => z.string().trim().max(max).catch("");
const manaValueSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(MAX_MANA_VALUE)
  .nullable()
  .catch(null);
const subtypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SUBTYPE_LENGTH)
  .regex(SUBTYPE_PATTERN);

/** Sous-types valides, sans doublon (casse ignorée), dix au plus. */
function parseSubtypes(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const parsed = subtypeSchema.safeParse(value);
    if (!parsed.success) continue;
    const key = parsed.data.toLowerCase();
    if (result.some((item) => item.toLowerCase() === key)) continue;
    result.push(parsed.data);
  }
  return result.slice(0, MAX_SUBTYPES);
}

/** Codes d'extension valides, en minuscules, sans doublon, dix au plus. */
function parseSets(values: string[]): string[] {
  const codes = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => SET_CODE_PATTERN.test(value));
  return [...new Set(codes)].slice(0, MAX_SETS);
}

/** Valeur d'une liste autorisée, sinon la première (valeur par défaut). */
function oneOf<T extends string>(allowed: readonly [T, ...T[]], value: string) {
  return z.enum(allowed).catch(allowed[0]).parse(value);
}

const flagSchema = z
  .string()
  .transform((value) => ["1", "on", "true"].includes(value))
  .catch(false);

/**
 * Lit les paramètres d'URL de la recherche (formulaire GET). Toute valeur
 * invalide ou trafiquée est ignorée plutôt que de provoquer une erreur.
 */
export function parseCardSearch(params: RawParams): CardSearch {
  const name = textSchema(100).parse(first(params, "q"));
  const sortValue = first(params, "sort");
  const sort = z
    .enum(CARD_SORTS)
    .catch(defaultCardSort({ name }))
    .parse(sortValue || undefined);
  const manaValue = (key: string) => {
    const raw = first(params, key);
    return raw === "" ? null : manaValueSchema.parse(raw);
  };

  return {
    name,
    text: textSchema(200).parse(first(params, "text")),
    colors: pick(IDENTITY_FILTER_COLORS, all(params, "color")),
    colorMode: oneOf(COLOR_MODES, first(params, "cmode")),
    colorSource: oneOf(COLOR_SOURCES, first(params, "csrc")),
    types: pick(CARD_TYPES, all(params, "type")),
    subtypes: parseSubtypes(all(params, "sub")),
    typeMode: oneOf(TYPE_MODES, first(params, "tmode")),
    rarities: pick(RARITIES, all(params, "rarity")),
    sets: parseSets(all(params, "set")),
    manaValueMin: manaValue("mvMin"),
    manaValueMax: manaValue("mvMax"),
    commanderLegal: flagSchema.parse(first(params, "legal")),
    canBeCommander: flagSchema.parse(first(params, "commander")),
    gameChanger: flagSchema.parse(first(params, "gc")),
    // Sans nom recherché, la pertinence se replie sur la popularité.
    sort: sort === "relevance" && !name ? "popularity" : sort,
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE)
      .catch(1)
      .parse(first(params, "page") || 1),
  };
}

/** Tri appliqué quand aucun n'est demandé. */
export function defaultCardSort(search: Pick<CardSearch, "name">): CardSort {
  return search.name ? "relevance" : "popularity";
}

/**
 * Paramètres d'URL d'une recherche, sans les valeurs par défaut : l'inverse
 * de `parseCardSearch`, pour les liens de pagination.
 */
export function cardSearchToQuery(
  search: CardSearch,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  if (search.name) query.q = search.name;
  if (search.text) query.text = search.text;
  if (search.colors.length > 0) query.color = search.colors;
  if (search.colorMode !== "within") query.cmode = search.colorMode;
  if (search.colorSource !== "identity") query.csrc = search.colorSource;
  if (search.types.length > 0) query.type = search.types;
  if (search.subtypes.length > 0) query.sub = search.subtypes;
  if (search.typeMode !== "or") query.tmode = search.typeMode;
  if (search.rarities.length > 0) query.rarity = search.rarities;
  if (search.sets.length > 0) query.set = search.sets;
  if (search.manaValueMin !== null) query.mvMin = String(search.manaValueMin);
  if (search.manaValueMax !== null) query.mvMax = String(search.manaValueMax);
  if (search.commanderLegal) query.legal = "1";
  if (search.canBeCommander) query.commander = "1";
  if (search.gameChanger) query.gc = "1";
  if (search.sort !== defaultCardSort(search)) query.sort = search.sort;
  if (search.page > 1) query.page = String(search.page);
  return query;
}

/** Groupes de filtres actifs, hors nom, tri et page, dans l'ordre du formulaire. */
export function activeFilters(search: CardSearch): FilterGroup[] {
  const active: Record<FilterGroup, boolean> = {
    colors: search.colors.length > 0,
    types: search.types.length > 0 || search.subtypes.length > 0,
    manaValue: search.manaValueMin !== null || search.manaValueMax !== null,
    rarities: search.rarities.length > 0,
    sets: search.sets.length > 0,
    text: search.text !== "",
    commanderLegal: search.commanderLegal,
    canBeCommander: search.canBeCommander,
    gameChanger: search.gameChanger,
  };
  return FILTER_GROUPS.filter((group) => active[group]);
}

/** Nombre de filtres actifs, hors nom, tri et page. */
export function countActiveFilters(search: CardSearch): number {
  return activeFilters(search).length;
}

/** La recherche sans un groupe de filtres (modes compris), en page 1. */
export function withoutFilter(
  search: CardSearch,
  group: FilterGroup,
): CardSearch {
  const next: CardSearch = { ...search, page: 1 };
  switch (group) {
    case "colors":
      return {
        ...next,
        colors: [],
        colorMode: "within",
        colorSource: "identity",
      };
    case "types":
      return { ...next, types: [], subtypes: [], typeMode: "or" };
    case "manaValue":
      return { ...next, manaValueMin: null, manaValueMax: null };
    case "rarities":
      return { ...next, rarities: [] };
    case "sets":
      return { ...next, sets: [] };
    case "text":
      return { ...next, text: "" };
    default:
      return { ...next, [group]: false };
  }
}

/** La recherche sans aucun filtre : seuls le nom et le tri restent. */
export function withoutFilters(search: CardSearch): CardSearch {
  return FILTER_GROUPS.reduce(withoutFilter, search);
}

/** Filtre de couleurs tel que la base l'applique. */
export type ColorFilter =
  | { source: ColorSource; mode: "colorless" }
  | { source: ColorSource; mode: ColorMode; colors: Color[] };

/**
 * Filtre de couleurs à appliquer, ou null sans couleur choisie.
 * « Incolore » seul garde les cartes incolores, quel que soit le mode ;
 * avec d'autres couleurs, il est ignoré.
 */
export function colorFilter(search: CardSearch): ColorFilter | null {
  if (search.colors.length === 0) return null;
  const colors = search.colors.filter(isColor);
  const source = search.colorSource;
  if (colors.length === 0) return { source, mode: "colorless" };
  return { source, mode: search.colorMode, colors };
}
