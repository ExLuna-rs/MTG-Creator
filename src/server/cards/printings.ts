import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { normalizeCardName } from "@/domain/cards/normalize";
import type { Printing } from "@/domain/cards/printing";
import { getDb } from "@/server/db";
import { cardSets, printings } from "@/server/db/schema";

// Éditions papier des cartes et extensions (données publiques de Scryfall).

const printingColumns = {
  id: printings.id,
  setCode: printings.setCode,
  setName: printings.setName,
  collectorNumber: printings.collectorNumber,
  rarity: printings.rarity,
  releasedAt: printings.releasedAt,
  special: printings.special,
  imageUris: printings.imageUris,
  backImageUris: printings.backImageUris,
  artist: printings.artist,
  cardmarketId: printings.cardmarketId,
  tcgplayerId: printings.tcgplayerId,
  priceEur: printings.priceEur,
  priceUsd: printings.priceUsd,
  priceEurFoil: printings.priceEurFoil,
  priceUsdFoil: printings.priceUsdFoil,
};

/** Éditions d'une carte, des plus récentes aux plus anciennes. */
export async function listPrintings(oracleId: string): Promise<Printing[]> {
  return getDb()
    .select(printingColumns)
    .from(printings)
    .where(eq(printings.oracleId, oracleId))
    .orderBy(
      desc(printings.releasedAt),
      asc(printings.setCode),
      // Numéros de collection « 12 », « 12a », « 120 » : par longueur puis texte.
      asc(sql`length(${printings.collectorNumber})`),
      asc(printings.collectorNumber),
    );
}

/** Éditions demandées, avec la carte à laquelle chacune appartient. */
export async function getPrintings(
  ids: readonly string[],
): Promise<(Printing & { oracleId: string })[]> {
  if (ids.length === 0) return [];
  return getDb()
    .select({ ...printingColumns, oracleId: printings.oracleId })
    .from(printings)
    .where(inArray(printings.id, [...new Set(ids)]));
}

/** Éditions désignées par extension et numéro de collection (import d'une liste). */
export async function findPrintings(
  wanted: readonly { set: string; collectorNumber: string }[],
): Promise<(Printing & { oracleId: string })[]> {
  if (wanted.length === 0) return [];
  return getDb()
    .select({ ...printingColumns, oracleId: printings.oracleId })
    .from(printings)
    .where(
      or(
        ...wanted.map(({ set, collectorNumber }) =>
          and(
            eq(printings.setCode, set.toLowerCase()),
            eq(printings.collectorNumber, collectorNumber),
          ),
        ),
      ),
    );
}

export interface CardSet {
  code: string;
  name: string;
  releasedAt: string;
}

/** Extensions dont le nom ou le code ressemble à la saisie (suggestions). */
export async function searchSets(query: string, limit = 8): Promise<CardSet[]> {
  const wanted = normalizeCardName(query);
  if (!wanted) return [];
  const code = query.trim().toLowerCase();
  return getDb()
    .select({
      code: cardSets.code,
      name: cardSets.name,
      releasedAt: cardSets.releasedAt,
    })
    .from(cardSets)
    .where(
      sql`${cardSets.code} = ${code} or ${cardSets.searchName} like ${`%${wanted}%`}`,
    )
    .orderBy(
      // Code exact, puis nom qui commence par la saisie, puis les plus récentes.
      desc(sql`${cardSets.code} = ${code}`),
      desc(sql`${cardSets.searchName} like ${`${wanted}%`}`),
      desc(cardSets.releasedAt),
    )
    .limit(limit);
}

/** Extensions par code (pour afficher les filtres actifs). */
export async function getSets(codes: readonly string[]): Promise<CardSet[]> {
  if (codes.length === 0) return [];
  return getDb()
    .select({
      code: cardSets.code,
      name: cardSets.name,
      releasedAt: cardSets.releasedAt,
    })
    .from(cardSets)
    .where(inArray(cardSets.code, [...codes]));
}
