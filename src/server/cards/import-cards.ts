// Logique d'import des cartes, partagée par le script sync-cards et les tests.
// Pas d'`import "server-only"` ici : ce module tourne aussi hors de Next.js.
import { getTableColumns, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  isDeckCard,
  type ScryfallCard,
  toCardRow,
} from "../../domain/cards/scryfall";
import { cardImports, cards } from "../db/schema";

const BATCH_SIZE = 500;

// Mise à jour de toutes les colonnes en cas de conflit sur oracle_id.
const { oracleId: _key, ...updatableColumns } = getTableColumns(cards);
const upsertSet = Object.fromEntries(
  Object.entries(updatableColumns).map(([key, column]) => [
    key,
    sql.raw(`excluded."${column.name}"`),
  ]),
);

export interface ImportOptions {
  /** URL du fichier Scryfall ou chemin du fichier local. */
  source: string;
  sourceUpdatedAt: Date | null;
  /** Import complet : supprime les cartes absentes de la source. */
  fullImport: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  removed: number;
}

/**
 * Importe des cartes Scryfall (une carte JSON par ligne) dans une seule
 * transaction : la base n'est jamais à moitié remplie.
 */
export async function importCards(
  db: NodePgDatabase,
  lines: AsyncIterable<string>,
  options: ImportOptions,
): Promise<ImportResult> {
  const startedAt = new Date();
  const result: ImportResult = { imported: 0, skipped: 0, removed: 0 };

  await db.transaction(async (tx) => {
    let batch: (typeof cards.$inferInsert)[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      await tx
        .insert(cards)
        .values(batch)
        .onConflictDoUpdate({ target: cards.oracleId, set: upsertSet });
      result.imported += batch.length;
      batch = [];
    };

    for await (const line of lines) {
      if (!line.trim()) continue;
      const card = JSON.parse(line) as ScryfallCard;
      if (!isDeckCard(card)) {
        result.skipped++;
        continue;
      }
      batch.push({ ...toCardRow(card), syncedAt: startedAt });
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    if (options.fullImport) {
      const deleted = await tx
        .delete(cards)
        .where(lt(cards.syncedAt, startedAt))
        .returning({ oracleId: cards.oracleId });
      result.removed = deleted.length;
    }

    await tx.insert(cardImports).values({
      source: options.source,
      sourceUpdatedAt: options.sourceUpdatedAt,
      cardCount: result.imported,
      startedAt,
      finishedAt: new Date(),
    });
  });

  return result;
}
