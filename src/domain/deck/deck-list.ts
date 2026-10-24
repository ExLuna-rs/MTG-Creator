import { z } from "zod";
import { COLORS, type Color, colorsToMask } from "../cards/colors";
import { normalizeCardName } from "../cards/normalize";
import { DECK_STATUSES, type DeckStatus } from "../collection/ownership";

/** Tris de « Mes decks » ; les favoris passent toujours en tête. */
export const DECK_SORTS = [
  "updated",
  "name",
  "price",
  "created",
  "color",
  "commander",
] as const;

export type DeckSort = (typeof DECK_SORTS)[number];

export const DECK_VALIDITIES = ["valid", "invalid"] as const;

export type DeckValidity = (typeof DECK_VALIDITIES)[number];

/** Dossier affiché : tous les decks, les favoris, ceux sans dossier, ou un dossier. */
export type DeckFolderView = "all" | "favorites" | "none" | { id: string };

export interface DeckListQuery {
  folder: DeckFolderView;
  q: string;
  /** Couleurs que l'identité du deck doit toutes contenir. */
  colors: Color[];
  status: DeckStatus | null;
  validity: DeckValidity | null;
  sort: DeckSort;
}

export const MAX_FOLDER_NAME_LENGTH = 50;
/** Au-delà, la colonne des dossiers deviendrait illisible. */
export const MAX_DECK_FOLDERS = 100;

export const folderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FOLDER_NAME_LENGTH);

/** Rangement d'un deck : dossier (null = sans dossier) et favori. */
export const deckPlacementSchema = z
  .object({
    folderId: z.uuid().nullable().optional(),
    favorite: z.boolean().optional(),
  })
  .refine(
    (value) => value.folderId !== undefined || value.favorite !== undefined,
  );

export type DeckPlacement = z.infer<typeof deckPlacementSchema>;

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Lit les paramètres d'URL de « Mes decks ». Une valeur invalide est ignorée
 * plutôt que de provoquer une erreur.
 */
export function parseDeckListQuery(params: RawParams): DeckListQuery {
  const folderValue = first(params, "folder");
  const folder: DeckFolderView =
    folderValue === "favorites" || folderValue === "none"
      ? folderValue
      : z.uuid().safeParse(folderValue).success
        ? { id: folderValue }
        : "all";
  const colorValue = first(params, "colors").toUpperCase();
  return {
    folder,
    q: z.string().trim().max(100).catch("").parse(first(params, "q")),
    colors: COLORS.filter((color) => colorValue.includes(color)),
    status: z
      .enum(DECK_STATUSES)
      .nullable()
      .catch(null)
      .parse(first(params, "status") || null),
    validity: z
      .enum(DECK_VALIDITIES)
      .nullable()
      .catch(null)
      .parse(first(params, "valid") || null),
    sort: z.enum(DECK_SORTS).catch("updated").parse(first(params, "sort")),
  };
}

/** Paramètres d'URL d'une vue de « Mes decks », sans les valeurs par défaut. */
export function deckListQueryToParams(
  query: Partial<DeckListQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  const { folder = "all" } = query;
  if (folder !== "all") {
    params.folder = typeof folder === "string" ? folder : folder.id;
  }
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.colors && query.colors.length > 0) {
    params.colors = query.colors.join("");
  }
  if (query.status) params.status = query.status;
  if (query.validity) params.valid = query.validity;
  if (query.sort && query.sort !== "updated") params.sort = query.sort;
  return params;
}

/** Ce que le tri et les filtres lisent d'un deck. */
export interface ListedDeck {
  name: string;
  commanders: readonly { name: string }[];
  colorIdentity: number;
  valid: boolean;
  status: DeckStatus;
  priceEur: number;
  priceUsd: number;
  updatedAt: Date;
  createdAt: Date;
  folderId: string | null;
  favorite: boolean;
}

export function inFolder(deck: ListedDeck, folder: DeckFolderView): boolean {
  if (folder === "all") return true;
  if (folder === "favorites") return deck.favorite;
  if (folder === "none") return deck.folderId === null;
  return deck.folderId === folder.id;
}

function bitCount(mask: number): number {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) count++;
  return count;
}

/** Monocolores en premier (WUBRG), puis bicolores…, incolores en dernier. */
function colorRank(mask: number): number {
  return mask === 0 ? 1000 : bitCount(mask) * 100 + mask;
}

/**
 * Decks du dossier choisi qui passent les filtres (hors statut et
 * validité si `ignoreStatus`), triés : favoris d'abord, puis le tri demandé,
 * puis le nom.
 */
export function selectDecks<T extends ListedDeck>(
  decks: readonly T[],
  query: DeckListQuery,
  {
    currency = "EUR",
    ignoreStatus = false,
  }: { currency?: "EUR" | "USD"; ignoreStatus?: boolean } = {},
): T[] {
  const wanted = normalizeCardName(query.q);
  const mask = colorsToMask(query.colors);
  const price = (deck: T) =>
    currency === "EUR" ? deck.priceEur : deck.priceUsd;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const commander = (deck: T) => deck.commanders[0]?.name ?? "￿";
  const keys: Record<DeckSort, (a: T, b: T) => number> = {
    updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    name: () => 0,
    price: (a, b) => price(b) - price(a),
    created: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    color: (a, b) => colorRank(a.colorIdentity) - colorRank(b.colorIdentity),
    commander: (a, b) => commander(a).localeCompare(commander(b), "en"),
  };
  return decks
    .filter(
      (deck) =>
        inFolder(deck, query.folder) &&
        (!wanted ||
          [deck.name, ...deck.commanders.map((card) => card.name)].some(
            (name) => normalizeCardName(name).includes(wanted),
          )) &&
        (deck.colorIdentity & mask) === mask &&
        (ignoreStatus ||
          ((!query.status || deck.status === query.status) &&
            (!query.validity || deck.valid === (query.validity === "valid")))),
    )
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        keys[query.sort](a, b) ||
        byName(a, b),
    );
}
