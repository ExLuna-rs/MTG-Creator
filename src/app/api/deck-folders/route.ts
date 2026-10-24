import type { NextRequest } from "next/server";
import { z } from "zod";
import { folderNameSchema } from "@/domain/deck/deck-list";
import { getCurrentSession } from "@/server/auth/session";
import { createDeckFolder } from "@/server/decks/folders";

const bodySchema = z.object({ name: folderNameSchema });

// Crée un dossier de « Mes decks » pour l'utilisateur connecté.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "invalid" }, { status: 400 });

  const result = await createDeckFolder(session.user.id, body.data.name);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result.folder, { status: 201 });
}
