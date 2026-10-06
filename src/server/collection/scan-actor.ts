import "server-only";
import { scanTokenSchema } from "@/domain/collection/schema";
import { getCurrentSession } from "@/server/auth/session";
import { findScanSession, type ScanActor } from "./scan";

/**
 * Utilisateur qui scanne : le téléphone relié par QR code envoie son jeton
 * dans l'en-tête `Authorization: Bearer …` ; sinon, la session de
 * l'utilisateur connecté. Null si aucun des deux n'est valide.
 */
export async function getScanActor(
  request: Request,
): Promise<ScanActor | null> {
  const header = request.headers.get("authorization");
  if (header) {
    const token = scanTokenSchema.safeParse(header.replace(/^Bearer /, ""));
    return token.success ? findScanSession(token.data) : null;
  }
  const session = await getCurrentSession();
  return session
    ? {
        userId: session.user.id,
        userName: session.user.name,
        scanSessionId: null,
      }
    : null;
}

export const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });
