import type { NextRequest } from "next/server";
import { z } from "zod";
import { suggestCardNames } from "@/server/cards/search";

const querySchema = z.string().trim().min(2).max(100);

// Suggestions de noms de cartes pendant la saisie (données publiques).
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!query.success) return Response.json({ cards: [] });

  const cards = await suggestCardNames(query.data);
  return Response.json(
    { cards },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
