import type { NextRequest } from "next/server";
import { parseCardSearch } from "@/domain/cards/search-query";
import { searchDeckCards } from "@/server/cards/search";

// Recherche de l'éditeur de deck (données publiques) : mêmes paramètres que
// la page de recherche, réponse avec les données utiles aux règles du deck.
export async function GET(request: NextRequest) {
  const params: Record<string, string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    params[key] = [...(params[key] ?? []), value];
  }
  const result = await searchDeckCards(parseCardSearch(params));
  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
