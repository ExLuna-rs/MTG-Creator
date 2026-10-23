import type { NextRequest } from "next/server";
import { z } from "zod";
import { deckAssemblySchema } from "@/domain/collection/schema";
import { getCurrentSession } from "@/server/auth/session";
import { setDeckAssembled } from "@/server/decks/copies";

// Monte un deck (il reçoit les exemplaires libres de la collection) ou le
// remet en construction. Réservé au propriétaire du deck (vérifié par
// setDeckAssembled). Le cookie de session est SameSite=Lax.
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/decks/[id]/assembly">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = deckAssemblySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const found = await setDeckAssembled(
    session.user.id,
    id.data,
    body.data.assembled,
  );
  if (!found) return Response.json({ error: "notFound" }, { status: 404 });
  return Response.json({ ok: true });
}
