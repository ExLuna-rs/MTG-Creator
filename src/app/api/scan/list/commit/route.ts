import { commitScanList } from "@/server/collection/scan";
import { getScanActor, unauthorized } from "@/server/collection/scan-actor";

// Ajoute toute la liste de scan à la collection, puis la vide.
export async function POST(request: Request) {
  const actor = await getScanActor(request);
  if (!actor) return unauthorized();
  return Response.json({ added: await commitScanList(actor.userId) });
}
