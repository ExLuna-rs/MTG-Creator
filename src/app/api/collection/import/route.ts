import type { NextRequest } from "next/server";
import { collectionImportSchema } from "@/domain/collection/schema";
import { getCurrentSession } from "@/server/auth/session";
import { addCollectionCards } from "@/server/collection/collection";

// Import d'une liste dans la collection de l'utilisateur connecté : les
// exemplaires s'ajoutent à ceux déjà possédés.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = collectionImportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  return Response.json(
    await addCollectionCards(session.user.id, body.data.cards),
  );
}
