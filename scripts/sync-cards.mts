// Importe les cartes Scryfall (fichier « Oracle Cards ») puis leurs éditions
// papier (fichier « Default Cards ») dans PostgreSQL.
//
//   node dist/scripts/sync-cards.mjs              import complet depuis Scryfall
//   node dist/scripts/sync-cards.mjs --file f [--printings p]
//                                                 import de fichiers JSONL
//                                                 (.gz ou non), sans suppression
//
// L'import complet supprime les cartes et éditions absentes des fichiers ;
// l'import de fichiers (jeu de test) ajoute ou met à jour sans rien supprimer.
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  type ImportOptions,
  type ImportResult,
  importCards,
} from "../src/server/cards/import-cards";
import { importPrintings } from "../src/server/cards/import-printings";
import { readLines } from "../src/server/cards/read-lines";

const USER_AGENT = "MTGCreator/0.1 (+https://github.com/ExLuna-rs/MTG-Creator)";
const BULK_DATA_URL = "https://api.scryfall.com/bulk-data";

interface BulkDataItem {
  type: string;
  updated_at: string;
  jsonl_download_uri: string;
}

interface Source extends ImportOptions {
  stream: NodeJS.ReadableStream;
}

async function openScryfallSource(
  type: "oracle_cards" | "default_cards",
): Promise<Source> {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  const listing = await fetch(BULK_DATA_URL, { headers });
  if (!listing.ok) throw new Error(`Scryfall a répondu ${listing.status}.`);
  const { data } = (await listing.json()) as { data: BulkDataItem[] };
  const bulk = data.find((item) => item.type === type);
  if (!bulk) throw new Error(`Fichier « ${type} » introuvable.`);

  const download = await fetch(bulk.jsonl_download_uri, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!download.ok || !download.body) {
    throw new Error(`Téléchargement impossible (${download.status}).`);
  }
  const body = Readable.fromWeb(download.body as WebReadableStream);
  return {
    source: bulk.jsonl_download_uri,
    sourceUpdatedAt: new Date(bulk.updated_at),
    fullImport: true,
    stream: body.pipe(createGunzip()),
  };
}

function openFileSource(path: string): Source {
  const file = createReadStream(path);
  return {
    source: path,
    sourceUpdatedAt: null,
    fullImport: false,
    stream: path.endsWith(".gz") ? file.pipe(createGunzip()) : file,
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} attend un chemin.`);
  return value;
}

type Importer = (
  db: NodePgDatabase,
  lines: AsyncIterable<string>,
  options: ImportOptions,
) => Promise<ImportResult>;

async function run(
  pool: pg.Pool,
  label: string,
  importer: Importer,
  { stream, ...options }: Source,
) {
  console.log(`Import des ${label} depuis ${options.source}`);
  const startedAt = Date.now();
  const result = await importer(
    drizzle({ client: pool }),
    readLines(stream as AsyncIterable<Uint8Array>),
    options,
  );
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `${result.imported} ${label} importées, ${result.skipped} objets ignorés, ${result.removed} supprimées, en ${seconds} s.`,
  );
}

async function main() {
  const filePath = argument("--file");
  const printingsPath = argument("--printings");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("La variable DATABASE_URL est obligatoire.");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await run(
      pool,
      "cartes",
      importCards,
      filePath
        ? openFileSource(filePath)
        : await openScryfallSource("oracle_cards"),
    );
    if (filePath && !printingsPath) return;
    await run(
      pool,
      "éditions",
      importPrintings,
      printingsPath
        ? openFileSource(printingsPath)
        : await openScryfallSource("default_cards"),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
