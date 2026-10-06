import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Vérifie le lien de scan du téléphone (ou la session) et donne le nom du
// propriétaire de la collection. Appelé régulièrement par la page de scan :
// l'ordinateur voit ainsi que le téléphone est connecté.
export async function GET(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();
  return Response.json(
    { name: actor.userName, linked: actor.scanSessionId !== null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
