import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewDeckForm } from "@/components/decks/new-deck-form";
import { requireSession } from "@/server/auth/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/decks/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "NewDeck",
  });
  return { title: t("title") };
}

export default async function NewDeckPage({
  params,
}: PageProps<"/[locale]/decks/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireSession(locale as Locale, "/decks/new");
  const t = await getTranslations("NewDeck");

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <NewDeckForm />
    </div>
  );
}
