import type { NextRequest } from "next/server";
import { z } from "zod";
import { canPair, hasPairingAbility } from "@/domain/commander/partners";
import {
  findCommanderCandidates,
  getDeckCardData,
} from "@/server/cards/search";

const querySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  // Premier commandant déjà choisi : seuls ses partenaires possibles sont renvoyés.
  with: z.uuid().optional().catch(undefined),
});

const LIMIT = 20;
// Candidats lus avant le filtrage des paires, qui se fait en TypeScript.
const PAIR_CANDIDATES = 300;

// Choix du commandant, puis du partenaire ou du Background (données publiques).
export async function GET(request: NextRequest) {
  const { q, with: firstId } = querySchema.parse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    with: request.nextUrl.searchParams.get("with") ?? undefined,
  });
  const headers = { "Cache-Control": "public, max-age=300" };

  if (!firstId) {
    const cards = await findCommanderCandidates(q, { limit: LIMIT });
    return Response.json(
      {
        cards: cards.map((card) => ({
          ...card,
          pairable: hasPairingAbility(card),
        })),
      },
      { headers },
    );
  }

  const [first] = await getDeckCardData([firstId]);
  if (!first || !hasPairingAbility(first)) {
    return Response.json({ cards: [] }, { headers });
  }
  const candidates = await findCommanderCandidates(q, {
    includeBackgrounds: true,
    limit: PAIR_CANDIDATES,
  });
  const cards = candidates
    .filter((card) => canPair(first, card))
    .slice(0, LIMIT)
    .map((card) => ({ ...card, pairable: true }));
  return Response.json({ cards }, { headers });
}
