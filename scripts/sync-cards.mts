// Importe les cartes Scryfall (fichier « Oracle Cards ») dans PostgreSQL.
//
//   node dist/scripts/sync-cards.mjs              import complet depuis Scryfall
//   node dist/scripts/sync-cards.mjs --file f     import d'un fichier JSONL
//                                                 (.gz ou non), sans suppression
//
// L'import complet supprime les cartes absentes du fichier ; l'import d'un
// fichier (jeu de test) ajoute ou met à jour sans rien supprimer.
// Le tout se fait dans une transaction : la base n'est jamais à moitié remplie.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { getTableColumns, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  isDeckCard,
  type ScryfallCard,
  toCardRow,
} from "../src/domain/cards/scryfall";
import { cardImports, cards } from "../src/server/db/schema";

const USER_AGENT = "MTGCreator/0.1 (+https://github.com/ExLuna-rs/MTG-Creator)";
const BULK_DATA_URL = "https://api.scryfall.com/bulk-data";
const BATCH_SIZE = 500;

interface BulkDataItem {
  type: string;
  updated_at: string;
  jsonl_download_uri: string;
}

interface Source {
  label: string;
  updatedAt: Date | null;
  stream: NodeJS.ReadableStream;
  fullImport: boolean;
}

async function openScryfallSource(): Promise<Source> {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  const listing = await fetch(BULK_DATA_URL, { headers });
  if (!listing.ok) throw new Error(`Scryfall a répondu ${listing.status}.`);
  const { data } = (await listing.json()) as { data: BulkDataItem[] };
  const bulk = data.find((item) => item.type === "oracle_cards");
  if (!bulk) throw new Error("Fichier « oracle_cards » introuvable.");

  const download = await fetch(bulk.jsonl_download_uri, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!download.ok || !download.body) {
    throw new Error(`Téléchargement impossible (${download.status}).`);
  }
  const body = Readable.fromWeb(
    download.body as import("node:stream/web").ReadableStream,
  );
  return {
    label: bulk.jsonl_download_uri,
    updatedAt: new Date(bulk.updated_at),
    stream: body.pipe(createGunzip()),
    fullImport: true,
  };
}

function openFileSource(path: string): Source {
  const file = createReadStream(path);
  return {
    label: path,
    updatedAt: null,
    stream: path.endsWith(".gz") ? file.pipe(createGunzip()) : file,
    fullImport: false,
  };
}

// Mise à jour de toutes les colonnes en cas de conflit sur oracle_id.
const { oracleId: _key, ...updatableColumns } = getTableColumns(cards);
const upsertSet = Object.fromEntries(
  Object.entries(updatableColumns).map(([key, column]) => [
    key,
    sql.raw(`excluded."${column.name}"`),
  ]),
);

async function main() {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  if (fileIndex >= 0 && !filePath) throw new Error("--file attend un chemin.");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("La variable DATABASE_URL est obligatoire.");

  const source = filePath
    ? openFileSource(filePath)
    : await openScryfallSource();
  console.log(`Import des cartes depuis ${source.label}`);

  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = drizzle({ client: pool });
  const startedAt = new Date();
  let imported = 0;
  let skipped = 0;
  let removed = 0;

  try {
    await db.transaction(async (tx) => {
      let batch: (typeof cards.$inferInsert)[] = [];
      const flush = async () => {
        if (batch.length === 0) return;
        await tx
          .insert(cards)
          .values(batch)
          .onConflictDoUpdate({ target: cards.oracleId, set: upsertSet });
        imported += batch.length;
        batch = [];
      };

      const lines = createInterface({
        input: source.stream,
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        if (!line.trim()) continue;
        const card = JSON.parse(line) as ScryfallCard;
        if (!isDeckCard(card)) {
          skipped++;
          continue;
        }
        batch.push({ ...toCardRow(card), syncedAt: startedAt });
        if (batch.length >= BATCH_SIZE) await flush();
      }
      await flush();

      if (source.fullImport) {
        const deleted = await tx
          .delete(cards)
          .where(lt(cards.syncedAt, startedAt))
          .returning({ oracleId: cards.oracleId });
        removed = deleted.length;
      }

      await tx.insert(cardImports).values({
        source: source.label,
        sourceUpdatedAt: source.updatedAt,
        cardCount: imported,
        startedAt,
        finishedAt: new Date(),
      });
    });
  } finally {
    await pool.end();
  }

  const seconds = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  console.log(
    `${imported} cartes importées, ${skipped} objets ignorés (jetons, plans…), ${removed} cartes supprimées, en ${seconds} s.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
