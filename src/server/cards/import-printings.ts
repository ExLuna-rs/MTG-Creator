// Import des éditions papier (fichier « Default Cards » de Scryfall), partagé
// par le script sync-cards et les tests. Pas d'`import "server-only"` ici :
// ce module tourne aussi hors de Next.js.
import { getTableColumns, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { normalizeCardName } from "../../domain/cards/normalize";
import {
  isPaperPrinting,
  type ScryfallPrinting,
  toPrintingRow,
} from "../../domain/cards/printing";
import { cardImports, cardSets, printings } from "../db/schema";
import type { ImportOptions, ImportResult } from "./import-cards";

const BATCH_SIZE = 500;

const { id: _key, ...updatableColumns } = getTableColumns(printings);
const upsertSet = Object.fromEntries(
  Object.entries(updatableColumns).map(([key, column]) => [
    key,
    sql.raw(`excluded."${column.name}"`),
  ]),
);

/**
 * Importe les éditions papier (une impression JSON par ligne) dans une seule
 * transaction, puis recalcule la liste des extensions.
 */
export async function importPrintings(
  db: NodePgDatabase,
  lines: AsyncIterable<string>,
  options: ImportOptions,
): Promise<ImportResult> {
  const startedAt = new Date();
  const result: ImportResult = { imported: 0, skipped: 0, removed: 0 };

  await db.transaction(async (tx) => {
    let batch: (typeof printings.$inferInsert)[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      await tx
        .insert(printings)
        .values(batch)
        .onConflictDoUpdate({ target: printings.id, set: upsertSet });
      result.imported += batch.length;
      batch = [];
    };

    for await (const line of lines) {
      if (!line.trim()) continue;
      const card = JSON.parse(line) as ScryfallPrinting;
      if (!isPaperPrinting(card)) {
        result.skipped++;
        continue;
      }
      batch.push({ ...toPrintingRow(card), syncedAt: startedAt });
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    if (options.fullImport) {
      const deleted = await tx
        .delete(printings)
        .where(lt(printings.syncedAt, startedAt))
        .returning({ id: printings.id });
      result.removed = deleted.length;
    }

    // Extensions : nom, type, date de sortie et nombre de cartes différentes.
    const sets = await tx
      .select({
        code: printings.setCode,
        name: sql<string>`max(${printings.setName})`,
        setType: sql<string>`max(${printings.setType})`,
        releasedAt: sql<string>`min(${printings.releasedAt})`,
        cardCount: sql<number>`count(distinct ${printings.oracleId})::int`,
      })
      .from(printings)
      .groupBy(printings.setCode);
    await tx.delete(cardSets);
    for (let start = 0; start < sets.length; start += BATCH_SIZE) {
      await tx.insert(cardSets).values(
        sets.slice(start, start + BATCH_SIZE).map((set) => ({
          ...set,
          searchName: normalizeCardName(set.name),
        })),
      );
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
