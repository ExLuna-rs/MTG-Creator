import { scanTextSchema } from "@/domain/collection/schema";
import { confidentMatch } from "@/domain/scan/ocr-name";
import { matchScannedName } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Cartes correspondant au nom lu par la caméra du téléphone. Réservé à un
// utilisateur connecté ou à un téléphone relié : la requête est plus coûteuse
// qu'une simple suggestion.
export async function POST(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();

  const body = scanTextSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const candidates = await matchScannedName(body.data.text);
  return Response.json({
    candidates,
    match: confidentMatch(candidates)?.oracleId ?? null,
  });
}
