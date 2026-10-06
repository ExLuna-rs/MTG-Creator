import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/server/auth/session";
import {
  deleteScanSession,
  getScanSessionStatus,
} from "@/server/collection/scan";

// État d'un lien de scan, interrogé régulièrement par l'ordinateur : le
// téléphone est-il connecté, le lien a-t-il expiré ?
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/scan/sessions/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });

  const status = await getScanSessionStatus(session.user.id, id.data);
  if (!status) return Response.json({ error: "notFound" }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}

/** Déconnecte le téléphone : le lien de scan ne fonctionne plus. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/scan/sessions/[id]">,
) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await deleteScanSession(session.user.id, id.data))) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
