import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { DeckEditor } from "@/components/decks/deck-editor";
import { requireSession } from "@/server/auth/session";
import { getOwnedDeck } from "@/server/decks/decks";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/decks/[id]/edit">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "DeckEditor",
  });
  return { title: t("title") };
}

export default async function DeckEditorPage({
  params,
}: PageProps<"/[locale]/decks/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { user } = await requireSession(locale as Locale, `/decks/${id}/edit`);
  const deckId = z.uuid().safeParse(id);
  // Deck inexistant ou d'un autre utilisateur : même réponse, introuvable.
  const deck = deckId.success ? await getOwnedDeck(user.id, deckId.data) : null;
  if (!deck) notFound();
  const t = await getTranslations("DeckEditor");

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6">
      <DeckEditor
        deckId={deck.id}
        name={deck.name}
        entries={deck.entries}
        cards={deck.cards}
        defaultCategories={t("defaultCategories")
          .split(",")
          .map((category) => category.trim())}
      />
    </div>
  );
}
