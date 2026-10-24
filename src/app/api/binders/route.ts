import type { NextRequest } from "next/server";
import { z } from "zod";
import { binderNameSchema } from "@/domain/collection/binders";
import { getCurrentSession } from "@/server/auth/session";
import { createBinder } from "@/server/collection/binders";

const bodySchema = z.object({ name: binderNameSchema });

// Crée un classeur de la collection pour l'utilisateur connecté.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await createBinder(session.user.id, body.data.name);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result.binder, { status: 201 });
}
