import { z } from "zod";
import { scanListChangeSchema } from "@/domain/collection/schema";
import { updateScanListItem } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2 ** 31 - 1);

// Correction d'une ligne de la liste de scan : autre carte ou autre quantité.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/scan/list/[id]">,
) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "notFound" }, { status: 404 });
  const body = scanListChangeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await updateScanListItem(actor.userId, id.data, body.data);
  if (!result.ok) {
    const status = result.error === "notFound" ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ item: result.item });
}

/** Retire une ligne de la liste de scan. */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/scan/list/[id]">,
) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const id = idSchema.safeParse((await ctx.params).id);
  const result = id.success
    ? await updateScanListItem(actor.userId, id.data, { quantity: 0 })
    : null;
  if (!result?.ok) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
