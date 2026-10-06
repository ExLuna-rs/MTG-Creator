import { scannedCardSchema } from "@/domain/collection/schema";
import { addScannedCard } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Ajoute un exemplaire d'une carte scannée à la collection.
export async function POST(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const body = scannedCardSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await addScannedCard(actor, body.data.oracleId);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ card: result.card, quantity: result.quantity });
}
