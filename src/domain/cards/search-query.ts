import { z } from "zod";
import { RARITIES } from "./card";
import { COLORS } from "./colors";
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

/** Couleurs du filtre d'identité ; « C » seul = cartes incolores uniquement. */
export const IDENTITY_FILTER_COLORS = [...COLORS, "C"] as const;

export const CARD_PAGE_SIZE = 60;
const MAX_PAGE = 500;
const MAX_MANA_VALUE = 20;

export interface CardSearch {
  name: string;
  text: string;
  colors: (typeof IDENTITY_FILTER_COLORS)[number][];
  types: (typeof CARD_TYPES)[number][];
  rarities: (typeof RARITIES)[number][];
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
    .catch(name ? "relevance" : "popularity")
    .parse(sortValue || undefined);
  const manaValue = (key: string) => {
    const raw = first(params, key);
    return raw === "" ? null : manaValueSchema.parse(raw);
  };

  return {
    name,
    text: textSchema(200).parse(first(params, "text")),
    colors: pick(IDENTITY_FILTER_COLORS, all(params, "color")),
    types: pick(CARD_TYPES, all(params, "type")),
    rarities: pick(RARITIES, all(params, "rarity")),
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
