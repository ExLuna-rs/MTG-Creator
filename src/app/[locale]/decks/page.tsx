import { CircleAlert, CircleCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { CardImage } from "@/components/cards/card-image";
import { ColorIdentity } from "@/components/decks/color-identity";
import { buttonVariants } from "@/components/ui/button";
import { COMMANDER_DECK_SIZE } from "@/domain/deck/deck";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/server/auth/session";
import { listDecks } from "@/server/decks/decks";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/decks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "DecksPage",
  });
  return { title: t("title") };
}

export default async function DecksPage({
  params,
}: PageProps<"/[locale]/decks">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { user } = await requireSession(locale as Locale, "/decks");
  const t = await getTranslations("DecksPage");
  const format = await getFormatter();
  const decks = await listDecks(user.id);
  const currency = locale === "en" ? "USD" : "EUR";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("count", { count: decks.length })}
          </p>
        </div>
        <Link href="/decks/new" className={buttonVariants()}>
          <Plus aria-hidden />
          {t("newDeck")}
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="font-medium">{t("empty")}</p>
          <p className="mt-1 text-muted-foreground text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const cover = deck.commanders[0];
            return (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}/edit`}
                  className="group flex h-full gap-4 rounded-xl border bg-card p-4 text-card-foreground outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <div className="w-20 shrink-0">
                    <CardImage
                      imageUris={cover?.imageUris ?? null}
                      name={cover?.name ?? deck.name}
                      decorative
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h2 className="truncate font-semibold group-hover:underline">
                      {deck.name}
                    </h2>
                    <p className="truncate text-muted-foreground text-sm">
                      {deck.commanders.map((card) => card.name).join(" & ") ||
                        t("noCommander")}
                    </p>
                    <ColorIdentity mask={deck.colorIdentity} />
                    <p className="flex items-center gap-1.5 text-sm">
                      {deck.valid ? (
                        <CircleCheck
                          className="size-4 text-primary"
                          aria-hidden
                        />
                      ) : (
                        <CircleAlert
                          className="size-4 text-destructive"
                          aria-hidden
                        />
                      )}
                      <span className="tabular-nums">
                        {t("cards", {
                          count: deck.cardCount,
                          expected: COMMANDER_DECK_SIZE,
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        · {deck.valid ? t("valid") : t("invalid")}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {format.number(
                        currency === "EUR" ? deck.priceEur : deck.priceUsd,
                        { style: "currency", currency },
                      )}
                      {" · "}
                      {t("updated", {
                        date: format.dateTime(deck.updatedAt, {
                          dateStyle: "medium",
                        }),
                      })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
