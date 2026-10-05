import type { NextRequest } from "next/server";
import { z } from "zod";
import { deckSaveSchema } from "@/domain/deck/schema";
import { getCurrentSession } from "@/server/auth/session";
import { saveDeck } from "@/server/decks/decks";

// Sauvegarde automatique de l'éditeur : remplace le nom et les cartes du deck.
// Réservée au propriétaire du deck (vérifié par saveDeck). Le cookie de
// session est SameSite=Lax : un autre site ne peut pas l'envoyer ici.
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/decks/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = deckSaveSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await saveDeck(session.user.id, id.data, body.data);
  if (!result.ok) {
    const status = result.error === "notFound" ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ updatedAt: result.updatedAt.toISOString() });
}
