import type { NextRequest } from "next/server";
import { z } from "zod";
import { binderNameSchema } from "@/domain/collection/binders";
import { getCurrentSession } from "@/server/auth/session";
import { deleteBinder, renameBinder } from "@/server/collection/binders";

const bodySchema = z.object({ name: binderNameSchema });

// Renomme ou supprime un classeur de l'utilisateur connecté (vérifié par les
// fonctions d'accès aux données).
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/binders/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await renameBinder(session.user.id, id.data, body.data.name);
  if (!result.ok) {
    const status = result.error === "notFound" ? 404 : 409;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.binder);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/binders/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await deleteBinder(session.user.id, id.data))) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
