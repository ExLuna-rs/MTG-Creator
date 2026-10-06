import { scannedCardSchema } from "@/domain/collection/schema";
import { addToScanList, getScanList } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Liste de scan de l'utilisateur : cartes scannées en attente, partagées entre
// le téléphone et l'ordinateur, qui l'interrogent régulièrement.
export async function GET(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();
  return Response.json(
    { items: await getScanList(actor.userId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Ajoute un exemplaire d'une carte scannée (ou choisie par son nom). */
export async function POST(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const body = scannedCardSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const item = await addToScanList(actor.userId, body.data.oracleId);
  if (!item) return Response.json({ error: "unknownCard" }, { status: 400 });
  return Response.json({ item });
}
