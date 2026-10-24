import type { NextRequest } from "next/server";
import { z } from "zod";
import { folderNameSchema } from "@/domain/deck/deck-list";
import { getCurrentSession } from "@/server/auth/session";
import { deleteDeckFolder, renameDeckFolder } from "@/server/decks/folders";

const bodySchema = z.object({ name: folderNameSchema });

// Renomme ou supprime un dossier de l'utilisateur connecté (vérifié par les
// fonctions d'accès aux données).
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/deck-folders/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await renameDeckFolder(
    session.user.id,
    id.data,
    body.data.name,
  );
  if (!result.ok) {
    const status = result.error === "notFound" ? 404 : 409;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.folder);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/deck-folders/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await deleteDeckFolder(session.user.id, id.data))) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
