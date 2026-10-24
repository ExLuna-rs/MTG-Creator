import type { NextRequest } from "next/server";
import { z } from "zod";
import { searchSets } from "@/server/cards/printings";

const querySchema = z.string().trim().min(1).max(60);

// Suggestions d'extensions pendant la saisie (données publiques).
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!query.success) return Response.json({ sets: [] });

  const sets = await searchSets(query.data);
  return Response.json(
    { sets },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
