import type { NextRequest } from "next/server";
import { collectionChangeSchema } from "@/domain/collection/schema";
import { getCurrentSession } from "@/server/auth/session";
import { changeCollectionCard } from "@/server/collection/collection";

// Ajout et retrait d'exemplaires dans la collection de l'utilisateur connecté.
// Le cookie de session est SameSite=Lax : un autre site ne peut pas l'envoyer ici.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = collectionChangeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await changeCollectionCard(
    session.user.id,
    body.data.oracleId,
    body.data.delta,
  );
  if (!result.ok)
    return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ quantity: result.quantity });
}
