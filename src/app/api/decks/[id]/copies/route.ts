import type { NextRequest } from "next/server";
import { z } from "zod";
import { takeCopySchema } from "@/domain/collection/schema";
import { getCurrentSession } from "@/server/auth/session";
import { takeCopy } from "@/server/decks/copies";

// Range dans le deck un exemplaire physique d'une carte, pris parmi les
// exemplaires libres de la collection ou dans un autre deck. Les deux decks
// doivent appartenir à l'utilisateur (vérifié par takeCopy). Le cookie de
// session est SameSite=Lax.
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/decks/[id]/copies">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = takeCopySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await takeCopy(session.user.id, id.data, body.data);
  if (!result.ok) {
    const status = result.error === "notFound" ? 404 : 409;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ok: true });
}
