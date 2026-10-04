// Applique les migrations SQL du dossier drizzle/ sur la base DATABASE_URL.
// Lancé par le service Docker `migrate` avant le démarrage de l'application :
// node scripts/migrate.mts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("La variable DATABASE_URL est obligatoire.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 1 });

try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("Migrations appliquées.");
} finally {
  await pool.end();
}
