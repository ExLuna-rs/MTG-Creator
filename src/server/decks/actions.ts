"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { newDeckSchema } from "@/domain/deck/schema";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { createDeck, deleteDeck } from "./decks";

// Actions serveur des decks. Chacune vérifie la session elle-même : une
// action est joignable par une simple requête POST, hors de l'interface.

export type NewDeckState = {
  error?: "invalid" | "unknownCard" | "notACommander" | "invalidPair";
};

/** Formulaire « Nouveau deck » : crée le deck puis ouvre l'éditeur. */
export async function createDeckAction(
  _previous: NewDeckState,
  formData: FormData,
): Promise<NewDeckState> {
  const locale = await getLocale();
  const session = await getCurrentSession();
  if (!session) {
    return redirect({
      href: { pathname: "/sign-in", query: { next: "/decks/new" } },
      locale,
    });
  }

  const input = newDeckSchema.safeParse({
    commanderId: formData.get("commanderId") || undefined,
    partnerId: formData.get("partnerId") || undefined,
    name: formData.get("name") || undefined,
  });
  if (!input.success) return { error: "invalid" };

  const result = await createDeck(session.user.id, input.data);
  if (!result.ok) return { error: result.error };
  return redirect({ href: `/decks/${result.deckId}/edit`, locale });
}

/** Supprime un deck de l'utilisateur, puis revient à « Mes decks ». */
export async function deleteDeckAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getCurrentSession();
  if (!session) {
    return redirect({ href: "/sign-in", locale });
  }
  const deckId = z.uuid().safeParse(formData.get("deckId"));
  if (deckId.success) await deleteDeck(session.user.id, deckId.data);
  return redirect({ href: "/decks", locale });
}
