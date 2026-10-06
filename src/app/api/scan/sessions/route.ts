import { getCurrentSession } from "@/server/auth/session";
import { createScanSession } from "@/server/collection/scan";

// Crée un lien de scan, affiché en QR code sur l'ordinateur pour relier un
// téléphone à la collection de l'utilisateur connecté.
export async function POST() {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id, token, expiresAt } = await createScanSession(session.user.id);
  return Response.json(
    { id, token, expiresAt: expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
