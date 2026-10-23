import type { NextRequest } from "next/server";
import { z } from "zod";
import { suggestSubtypes } from "@/server/cards/search";

const querySchema = z.string().trim().min(1).max(40);

// Suggestions de sous-types pendant la saisie (données publiques).
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!query.success) return Response.json({ subtypes: [] });

  const subtypes = await suggestSubtypes(query.data);
  return Response.json(
    { subtypes },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
