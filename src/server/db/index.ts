import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/server/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Conservé sur globalThis pour survivre au rechargement à chaud
// du serveur de développement sans ouvrir de nouvelles connexions.
const globalForDb = globalThis as unknown as { db?: Database };

/** Connexion à PostgreSQL, créée au premier appel. */
export function getDb(): Database {
  if (!globalForDb.db) {
    const pool = new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: 10,
    });
    globalForDb.db = drizzle({ client: pool, schema });
  }
  return globalForDb.db;
}
