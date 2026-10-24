import type { NextRequest } from "next/server";
import { z } from "zod";
import { binderQuantitySchema } from "@/domain/collection/binders";
import { getCurrentSession } from "@/server/auth/session";
import { setBinderQuantity } from "@/server/collection/binders";

// Range des exemplaires d'une carte dans un classeur de l'utilisateur
// connecté (vérifié par la fonction d'accès aux données). La réponse donne
// la quantité rangée, réduite si la collection n'en a pas assez.
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/binders/[id]/cards">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = binderQuantitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await setBinderQuantity(
    session.user.id,
    id.data,
    body.data.oracleId,
    body.data.quantity,
  );
  if (!result.ok) return Response.json({ error: "notFound" }, { status: 404 });
  return Response.json({ quantity: result.quantity });
}
