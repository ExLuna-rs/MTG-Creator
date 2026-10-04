import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CardGrid, type PriceCurrency } from "@/components/cards/card-grid";
import { CardPagination } from "@/components/cards/card-pagination";
import { CardSearchForm } from "@/components/cards/card-search-form";
import {
  type CardSearch,
  countActiveFilters,
  parseCardSearch,
} from "@/domain/cards/search-query";
import { getPathname } from "@/i18n/navigation";
import { searchCards } from "@/server/cards/search";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cards">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "CardSearch",
  });
  return { title: t("title"), description: t("description") };
}

/** Devise des prix affichés : celle du tri, sinon celle de la langue. */
function priceCurrency(search: CardSearch, locale: Locale): PriceCurrency {
  if (search.sort === "priceUsd") return "USD";
  if (search.sort === "priceEur") return "EUR";
  return locale === "en" ? "USD" : "EUR";
}

export default async function CardsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/cards">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("CardSearch");
  const search = parseCardSearch(await searchParams);
  const result = await searchCards(search);
  const isBlankSearch = !search.name && countActiveFilters(search) === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <CardSearchForm
        search={search}
        action={getPathname({ locale: locale as Locale, href: "/cards" })}
      />

      <section aria-labelledby="card-results" className="space-y-6">
        <h2
          id="card-results"
          aria-live="polite"
          className="font-medium text-muted-foreground text-sm"
        >
          {t("resultCount", { count: result.total })}
        </h2>

        {result.cards.length > 0 ? (
          <CardGrid
            cards={result.cards}
            currency={priceCurrency(search, locale as Locale)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            {isBlankSearch && result.total === 0 ? (
              <p>{t("emptyDatabase")}</p>
            ) : (
              <>
                <p className="font-medium">{t("noResults")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("noResultsHint")}
                </p>
              </>
            )}
          </div>
        )}

        <CardPagination search={search} pageCount={result.pageCount} />
      </section>
    </div>
  );
}
