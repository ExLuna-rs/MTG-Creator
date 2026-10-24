import type { NextRequest } from "next/server";
import { importNamesSchema } from "@/domain/import-export/schema";
import { getCurrentSession } from "@/server/auth/session";
import { findPrintings } from "@/server/cards/printings";
import { resolveCardNames } from "@/server/cards/search";

// Reconnaissance des noms d'une liste importée dans l'éditeur de deck. Les
// cartes sont publiques, mais la requête est plus coûteuse qu'une recherche :
// réservée aux utilisateurs connectés, comme l'éditeur.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = importNamesSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const [results, printings] = await Promise.all([
    resolveCardNames(body.data.names),
    findPrintings(body.data.printings ?? []),
  ]);
  return Response.json({ results, printings });
}
