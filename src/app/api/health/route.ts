import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

// Contrôle de santé (Docker, supervision) : l'application répond
// et la base de données aussi.
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
