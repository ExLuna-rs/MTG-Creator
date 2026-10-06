import { z } from "zod";
import { undoScannedCard } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Annule l'ajout d'une carte scannée : un exemplaire quitte la collection.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/scan/cards/[id]">,
) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const id = z.coerce
    .number()
    .int()
    .positive()
    .max(2 ** 31 - 1)
    .safeParse((await ctx.params).id);
  const quantity = id.success ? await undoScannedCard(actor, id.data) : null;
  if (quantity === null) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  return Response.json({ quantity });
}
