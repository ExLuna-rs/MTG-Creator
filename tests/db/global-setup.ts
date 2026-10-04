// Prépare une base PostgreSQL jetable pour les tests *.db.test.ts :
// création, migrations, import du jeu de cartes de test, puis suppression.
import { createReadStream } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { importCards } from "../../src/server/cards/import-cards";
import { readLines } from "../../src/server/cards/read-lines";

const TEST_DATABASE = "mtg_test";
const FIXTURE = "tests/fixtures/cards.jsonl";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

async function run(connectionString: string, statement: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject) {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL est obligatoire pour les tests de base de données (make test-db).",
    );
  }
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${TEST_DATABASE}`;

  await run(baseUrl, `drop database if exists ${TEST_DATABASE} with (force)`);
  await run(baseUrl, `create database ${TEST_DATABASE}`);

  const pool = new pg.Pool({ connectionString: testUrl.toString(), max: 1 });
  try {
    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: "drizzle" });
    await importCards(db, readLines(createReadStream(FIXTURE)), {
      source: FIXTURE,
      sourceUpdatedAt: null,
      fullImport: false,
    });
  } finally {
    await pool.end();
  }

  project.provide("testDatabaseUrl", testUrl.toString());

  return async () => {
    await run(baseUrl, `drop database if exists ${TEST_DATABASE} with (force)`);
  };
}
