import type { NextRequest } from "next/server";
import { collectionPrintingSchema } from "@/domain/collection/printings";
import { getCurrentSession } from "@/server/auth/session";
import { setPrintingQuantity } from "@/server/collection/printings";

// Précise l'édition et la finition d'exemplaires d'une carte de la
// collection de l'utilisateur connecté. La réponse donne la quantité gardée,
// réduite si la collection n'a pas assez d'exemplaires.
export async function PUT(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = collectionPrintingSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await setPrintingQuantity(session.user.id, body.data);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ quantity: result.quantity });
}
