// Importe les cartes Scryfall (fichier « Oracle Cards ») dans PostgreSQL.
//
//   node dist/scripts/sync-cards.mjs              import complet depuis Scryfall
//   node dist/scripts/sync-cards.mjs --file f     import d'un fichier JSONL
//                                                 (.gz ou non), sans suppression
//
// L'import complet supprime les cartes absentes du fichier ; l'import d'un
// fichier (jeu de test) ajoute ou met à jour sans rien supprimer.
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  type ImportOptions,
  importCards,
} from "../src/server/cards/import-cards";
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

async function main() {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  if (fileIndex >= 0 && !filePath) throw new Error("--file attend un chemin.");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("La variable DATABASE_URL est obligatoire.");
  }

  const { stream, ...options } = filePath
    ? openFileSource(filePath)
    : await openScryfallSource();
  console.log(`Import des cartes depuis ${options.source}`);

  const pool = new pg.Pool({ connectionString, max: 1 });
  const startedAt = Date.now();
  try {
    const result = await importCards(
      drizzle({ client: pool }),
      readLines(stream as AsyncIterable<Uint8Array>),
      options,
    );
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `${result.imported} cartes importées, ${result.skipped} objets ignorés (jetons, plans…), ${result.removed} cartes supprimées, en ${seconds} s.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
