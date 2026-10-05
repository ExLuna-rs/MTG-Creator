import type { NextRequest } from "next/server";
import { importNamesSchema } from "@/domain/import-export/schema";
import { getCurrentSession } from "@/server/auth/session";
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

  const results = await resolveCardNames(body.data.names);
  return Response.json({ results });
}
