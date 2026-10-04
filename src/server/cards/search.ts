import "server-only";
import {
  and,
  arrayOverlaps,
  asc,
  count,
  eq,
  gte,
  inArray,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import type { CardImageUris } from "@/domain/cards/card";
import { colorsToMask } from "@/domain/cards/colors";
import { normalizeCardName } from "@/domain/cards/normalize";
import { CARD_PAGE_SIZE, type CardSearch } from "@/domain/cards/search-query";
import { getDb } from "@/server/db";
import { cards } from "@/server/db/schema";

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

function buildConditions(search: CardSearch, normalizedName: string): SQL[] {
  const conditions: SQL[] = [];
  if (normalizedName) conditions.push(nameCondition(normalizedName));
  if (search.text) {
    conditions.push(
      sql`${cards.oracleText} ilike ${`%${escapeLike(search.text)}%`}`,
    );
  }
  if (search.colors.length > 0) {
    // Identité incluse dans les couleurs choisies (« C » seul : incolores).
    const outside = 31 & ~colorsToMask(search.colors);
    conditions.push(sql`(${cards.colorIdentity} & ${outside}) = 0`);
  }
  if (search.types.length > 0) {
    conditions.push(arrayOverlaps(cards.types, search.types));
  }
  if (search.rarities.length > 0) {
    conditions.push(inArray(cards.rarity, search.rarities));
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

/** Fiche complète d'une carte, ou null si l'identifiant est inconnu. */
export async function getCard(oracleId: string): Promise<CardDetails | null> {
  const [card] = await getDb()
    .select()
    .from(cards)
    .where(eq(cards.oracleId, oracleId))
    .limit(1);
  return card ?? null;
}
