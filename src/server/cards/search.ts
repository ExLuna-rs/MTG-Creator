import "server-only";
import {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  asc,
  count,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { CardImageUris } from "@/domain/cards/card";
import { colorsToMask } from "@/domain/cards/colors";
import { normalizeCardName } from "@/domain/cards/normalize";
import {
  CARD_PAGE_SIZE,
  type CardSearch,
  type ColorFilter,
  colorFilter,
} from "@/domain/cards/search-query";
import { type DeckCardData, frontName } from "@/domain/deck/deck";
import { getDb } from "@/server/db";
import { cards, printings } from "@/server/db/schema";

/** Carte telle qu'affichée dans une liste de résultats. */
export interface CardSummary {
  oracleId: string;
  name: string;
  manaCost: string | null;
  manaValue: number;
  typeLine: string;
  colorIdentity: number;
  imageUris: CardImageUris | null;
  rarity: string;
  gameChanger: boolean;
  commanderLegality: string;
  priceEur: number | null;
  priceUsd: number | null;
}

export interface CardSearchResult {
  cards: CardSummary[];
  total: number;
  page: number;
  pageCount: number;
}

export type CardDetails = typeof cards.$inferSelect;

const summaryColumns = {
  oracleId: cards.oracleId,
  name: cards.name,
  manaCost: cards.manaCost,
  manaValue: cards.manaValue,
  typeLine: cards.typeLine,
  colorIdentity: cards.colorIdentity,
  imageUris: cards.imageUris,
  rarity: cards.rarity,
  gameChanger: cards.gameChanger,
  commanderLegality: cards.commanderLegality,
  priceEur: cards.priceEur,
  priceUsd: cards.priceUsd,
};

/** Colonnes des données d'une carte utiles à l'éditeur de deck. */
export const deckCardColumns = {
  oracleId: cards.oracleId,
  name: cards.name,
  manaCost: cards.manaCost,
  manaValue: cards.manaValue,
  typeLine: cards.typeLine,
  oracleText: cards.oracleText,
  supertypes: cards.supertypes,
  types: cards.types,
  subtypes: cards.subtypes,
  colorIdentity: cards.colorIdentity,
  producedMana: cards.producedMana,
  commanderLegality: cards.commanderLegality,
  canBeCommander: cards.canBeCommander,
  gameChanger: cards.gameChanger,
  edhrecRank: cards.edhrecRank,
  priceEur: cards.priceEur,
  priceUsd: cards.priceUsd,
  imageUris: cards.imageUris,
};

/** Échappe les caractères spéciaux de LIKE (%, _ et \). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Condition de recherche par nom : le nom normalisé contient la saisie, ou
 * lui ressemble assez (similarité de trigrammes, tolère les fautes de frappe).
 */
function nameCondition(normalized: string): SQL {
  return sql`(${cards.searchName} like ${`%${escapeLike(normalized)}%`} or ${normalized} <% ${cards.searchName})`;
}

/**
 * Pertinence d'un nom : 0 = identique, 1 = un mot commence par la saisie,
 * 2 = le nom la contient, 3 = ressemblance seulement.
 * La saisie normalisée ne contient que des lettres, chiffres et espaces :
 * elle peut être utilisée telle quelle dans l'expression régulière.
 */
function nameRank(normalized: string): SQL {
  return sql`case
    when ${cards.searchName} = ${normalized} then 0
    when ${cards.searchName} ~ ${`\\m${normalized}`} then 1
    when ${cards.searchName} like ${`%${escapeLike(normalized)}%`} then 2
    else 3
  end`;
}

/**
 * Condition de couleurs. L'identité couleur est un masque de bits
 * (W=1, U=2, B=4, R=8, G=16) ; la couleur de la carte, une liste de lettres.
 */
function colorCondition(filter: ColorFilter): SQL {
  if (filter.source === "card") {
    const column = cards.colors;
    if (filter.mode === "colorless") return sql`cardinality(${column}) = 0`;
    const wanted = filter.colors;
    switch (filter.mode) {
      case "within":
        return arrayContained(column, wanted);
      case "exact":
        return sql`(${arrayContained(column, wanted)} and ${arrayContains(column, wanted)})`;
      case "all":
        return arrayContains(column, wanted);
      case "any":
        return arrayOverlaps(column, wanted);
    }
  }
  const identity = cards.colorIdentity;
  if (filter.mode === "colorless") return sql`${identity} = 0`;
  const mask = colorsToMask(filter.colors);
  switch (filter.mode) {
    case "within":
      return sql`(${identity} & ${31 & ~mask}) = 0`;
    case "exact":
      return sql`${identity} = ${mask}`;
    case "all":
      return sql`(${identity} & ${mask}) = ${mask}`;
    case "any":
      return sql`(${identity} & ${mask}) <> 0`;
  }
}

/** La carte a ce sous-type, sans tenir compte de la casse. */
function subtypeCondition(subtype: string): SQL {
  return sql`exists (select 1 from unnest(${cards.subtypes}) as subtype(name) where lower(subtype.name) = ${subtype.toLowerCase()})`;
}

function buildConditions(search: CardSearch, normalizedName: string): SQL[] {
  const conditions: SQL[] = [];
  if (normalizedName) conditions.push(nameCondition(normalizedName));
  if (search.text) {
    conditions.push(
      sql`${cards.oracleText} ilike ${`%${escapeLike(search.text)}%`}`,
    );
  }
  const colors = colorFilter(search);
  if (colors) conditions.push(colorCondition(colors));
  const types = [
    ...search.types.map((type) => arrayContains(cards.types, [type])),
    ...search.subtypes.map(subtypeCondition),
  ];
  if (types.length > 0) {
    const combined = search.typeMode === "and" ? and(...types) : or(...types);
    if (combined) conditions.push(combined);
  }
  if (search.rarities.length > 0) {
    conditions.push(inArray(cards.rarity, search.rarities));
  }
  if (search.sets.length > 0) {
    // Imprimée au moins une fois dans l'une des extensions, même si son
    // édition par défaut est ailleurs.
    conditions.push(
      sql`exists (select 1 from ${printings} where ${printings.oracleId} = ${cards.oracleId} and ${inArray(printings.setCode, search.sets)})`,
    );
  }
  if (search.manaValueMin !== null) {
    conditions.push(gte(cards.manaValue, search.manaValueMin));
  }
  if (search.manaValueMax !== null) {
    conditions.push(lte(cards.manaValue, search.manaValueMax));
  }
  if (search.commanderLegal) {
    conditions.push(eq(cards.commanderLegality, "legal"));
  }
  if (search.canBeCommander) conditions.push(eq(cards.canBeCommander, true));
  if (search.gameChanger) conditions.push(eq(cards.gameChanger, true));
  return conditions;
}

/**
 * Conditions des filtres d'une recherche, sans le nom : la collection les
 * applique à ses propres cartes.
 */
export function cardFilterConditions(search: CardSearch): SQL[] {
  return buildConditions(search, "");
}

function buildOrder(search: CardSearch, normalizedName: string): SQL[] {
  const popularity = sql`${cards.edhrecRank} asc nulls last`;
  switch (search.sort) {
    case "relevance": {
      if (!normalizedName) return [popularity, asc(cards.name)];
      const rank = nameRank(normalizedName);
      return [
        sql`${rank} asc`,
        // Parmi les simples ressemblances, la plus proche d'abord.
        sql`case when ${rank} = 3 then word_similarity(${normalizedName}, ${cards.searchName}) end desc nulls last`,
        popularity,
        asc(cards.name),
      ];
    }
    case "name":
      return [asc(cards.name)];
    case "manaValue":
      return [asc(cards.manaValue), asc(cards.name)];
    case "priceEur":
      return [sql`${cards.priceEur} asc nulls last`, asc(cards.name)];
    case "priceUsd":
      return [sql`${cards.priceUsd} asc nulls last`, asc(cards.name)];
    default:
      return [popularity, asc(cards.name)];
  }
}

/** Recherche de cartes avec filtres, tri et pagination. */
export async function searchCards(
  search: CardSearch,
): Promise<CardSearchResult> {
  const db = getDb();
  const normalizedName = normalizeCardName(search.name);
  const where = and(...buildConditions(search, normalizedName));

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(cards)
      .where(where)
      .orderBy(...buildOrder(search, normalizedName))
      .limit(CARD_PAGE_SIZE)
      .offset((search.page - 1) * CARD_PAGE_SIZE),
    db.select({ total: count() }).from(cards).where(where),
  ]);

  return {
    cards: rows,
    total,
    page: search.page,
    pageCount: Math.max(1, Math.ceil(total / CARD_PAGE_SIZE)),
  };
}

/**
 * Recherche pour l'éditeur de deck : mêmes filtres et même tri que la page
 * de recherche, mais avec les données dont les règles et les statistiques
 * ont besoin.
 */
export async function searchDeckCards(
  search: CardSearch,
): Promise<{ cards: DeckCardData[]; total: number; pageCount: number }> {
  const db = getDb();
  const normalizedName = normalizeCardName(search.name);
  const where = and(...buildConditions(search, normalizedName));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(deckCardColumns)
      .from(cards)
      .where(where)
      .orderBy(...buildOrder(search, normalizedName))
      .limit(CARD_PAGE_SIZE)
      .offset((search.page - 1) * CARD_PAGE_SIZE),
    db.select({ total: count() }).from(cards).where(where),
  ]);
  return {
    cards: rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / CARD_PAGE_SIZE)),
  };
}

/**
 * Candidats commandants dont le nom correspond à la saisie (tous, sans
 * saisie), les plus joués d'abord. `includeBackgrounds` ajoute les
 * enchantements légendaires, pour choisir un Background en second commandant.
 */
export async function findCommanderCandidates(
  query: string,
  { includeBackgrounds = false, limit = 20 } = {},
): Promise<DeckCardData[]> {
  const normalized = normalizeCardName(query);
  const eligible = includeBackgrounds
    ? sql`(${cards.canBeCommander} or (${cards.supertypes} @> array['Legendary'] and ${cards.types} @> array['Enchantment']))`
    : eq(cards.canBeCommander, true);
  return getDb()
    .select(deckCardColumns)
    .from(cards)
    .where(
      and(
        eligible,
        eq(cards.commanderLegality, "legal"),
        normalized ? nameCondition(normalized) : undefined,
      ),
    )
    .orderBy(
      ...(normalized ? [sql`${nameRank(normalized)} asc`] : []),
      sql`${cards.edhrecRank} asc nulls last`,
      asc(cards.name),
    )
    .limit(limit);
}

/** Données des cartes demandées (les identifiants inconnus sont ignorés). */
export async function getDeckCardData(
  oracleIds: readonly string[],
): Promise<DeckCardData[]> {
  if (oracleIds.length === 0) return [];
  return getDb()
    .select(deckCardColumns)
    .from(cards)
    .where(inArray(cards.oracleId, [...new Set(oracleIds)]));
}

/** Résultat de la reconnaissance d'un nom de carte importé. */
export interface ResolvedCardName {
  name: string;
  card: DeckCardData | null;
  /** Cartes au nom proche, quand le nom n'est pas reconnu. */
  suggestions: DeckCardData[];
}

/** Noms non reconnus pour lesquels des suggestions sont cherchées. */
const MAX_SUGGESTED_NAMES = 20;
const SUGGESTIONS_PER_NAME = 3;

/** Garde, pour chaque nom normalisé, la carte la plus jouée. */
function byPopularity(
  rows: DeckCardData[],
  key: (card: DeckCardData) => string,
) {
  const result = new Map<string, DeckCardData>();
  for (const card of rows) {
    const current = result.get(key(card));
    if (
      !current ||
      (card.edhrecRank ?? Infinity) < (current.edhrecRank ?? Infinity)
    ) {
      result.set(key(card), card);
    }
  }
  return result;
}

/**
 * Reconnaît les noms d'une liste importée : nom exact (sans tenir compte
 * des accents, de la casse ni de la ponctuation), puis nom de la face avant
 * (« Delver of Secrets » pour « Delver of Secrets // Insectile Aberration »,
 * comme l'exporte MTG Arena). Les noms inconnus reçoivent des suggestions.
 */
export async function resolveCardNames(
  names: readonly string[],
): Promise<ResolvedCardName[]> {
  const db = getDb();
  const normalized = names.map(normalizeCardName);
  const wanted = [...new Set(normalized.filter(Boolean))];
  if (wanted.length === 0) {
    return names.map((name) => ({ name, card: null, suggestions: [] }));
  }

  const exact = byPopularity(
    await db
      .select(deckCardColumns)
      .from(cards)
      .where(inArray(cards.searchName, wanted)),
    (card) => normalizeCardName(card.name),
  );

  const missing = wanted.filter((key) => !exact.has(key));
  const faces =
    missing.length === 0
      ? new Map<string, DeckCardData>()
      : byPopularity(
          await db
            .select(deckCardColumns)
            .from(cards)
            .where(
              and(
                like(cards.name, "% // %"),
                or(
                  ...missing.map((key) =>
                    like(cards.searchName, `${escapeLike(key)} %`),
                  ),
                ),
              ),
            ),
          (card) => normalizeCardName(frontName(card.name)),
        );

  const unknown = missing.filter((key) => !faces.has(key));
  const suggestions = new Map<string, DeckCardData[]>();
  for (const key of unknown.slice(0, MAX_SUGGESTED_NAMES)) {
    suggestions.set(
      key,
      await db
        .select(deckCardColumns)
        .from(cards)
        .where(nameCondition(key))
        .orderBy(
          sql`${nameRank(key)} asc`,
          sql`word_similarity(${key}, ${cards.searchName}) desc`,
          sql`${cards.edhrecRank} asc nulls last`,
          asc(cards.name),
        )
        .limit(SUGGESTIONS_PER_NAME),
    );
  }

  return names.map((name, index) => {
    const key = normalized[index];
    const card = exact.get(key) ?? faces.get(key) ?? null;
    return {
      name,
      card,
      suggestions: card ? [] : (suggestions.get(key) ?? []),
    };
  });
}

/** Suggestions de noms pendant la saisie. */
export async function suggestCardNames(
  query: string,
  limit = 8,
): Promise<{ oracleId: string; name: string }[]> {
  const normalized = normalizeCardName(query);
  if (normalized.length < 2) return [];
  return getDb()
    .select({ oracleId: cards.oracleId, name: cards.name })
    .from(cards)
    .where(nameCondition(normalized))
    .orderBy(
      sql`${nameRank(normalized)} asc`,
      sql`${cards.edhrecRank} asc nulls last`,
      asc(cards.name),
    )
    .limit(limit);
}

/** Sous-type proposé pendant la saisie, avec son nombre de cartes. */
export interface SubtypeSuggestion {
  name: string;
  count: number;
}

/**
 * Sous-types dont le nom contient la saisie : ceux qui commencent par elle
 * d'abord, puis les plus fréquents.
 */
export async function suggestSubtypes(
  query: string,
  limit = 8,
): Promise<SubtypeSuggestion[]> {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  const pattern = `%${escapeLike(wanted)}%`;
  const { rows } = await getDb().execute<{ name: string; count: number }>(
    sql`select subtype.name, count(*)::int as count
      from ${cards}, unnest(${cards.subtypes}) as subtype(name)
      where lower(subtype.name) like ${pattern}
      group by subtype.name
      order by lower(subtype.name) like ${`${escapeLike(wanted)}%`} desc, count desc, subtype.name
      limit ${limit}`,
  );
  return rows;
}

/** Fiche complète d'une carte, ou null si l'identifiant est inconnu. */
export async function getCard(oracleId: string): Promise<CardDetails | null> {
  const [card] = await getDb()
    .select()
    .from(cards)
    .where(eq(cards.oracleId, oracleId))
    .limit(1);
  return card ?? null;
}
