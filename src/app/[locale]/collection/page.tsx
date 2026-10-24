import { Camera } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { z } from "zod";
import { ActiveFilters } from "@/components/cards/active-filters";
import { CardSearchForm } from "@/components/cards/card-search-form";
import { AddCollectionCard } from "@/components/collection/add-collection-card";
import {
  BinderNav,
  BinderSelect,
  type BinderViewKey,
} from "@/components/collection/binder-nav";
import {
  CollectionDetails,
  type DeckInfo,
} from "@/components/collection/collection-details";
import { CollectionExport } from "@/components/collection/collection-export";
import { CollectionFilters } from "@/components/collection/collection-filters";
import { CollectionGrid } from "@/components/collection/collection-grid";
import { CollectionImport } from "@/components/collection/collection-import";
import { PendingScans } from "@/components/collection/pending-scans";
import { PhoneScan } from "@/components/collection/phone-scan";
import { buttonVariants } from "@/components/ui/button";
import { pageWithQuery } from "@/domain/cards/links";
import {
  activeFilters,
  cardSearchToQuery,
  parseCardSearch,
} from "@/domain/cards/search-query";
import {
  copiesInView,
  parseBinderView,
  unsortedCopies,
} from "@/domain/collection/binders";
import {
  COLLECTION_SHOWS,
  COLLECTION_SORTS,
  selectCollection,
} from "@/domain/collection/collection";
import { cardUsage, deckStatus } from "@/domain/collection/ownership";
import { getPathname, Link } from "@/i18n/navigation";
import { requireSession } from "@/server/auth/session";
import { getSets } from "@/server/cards/printings";
import { getBinderSplits, listBinders } from "@/server/collection/binders";
import {
  filterCollection,
  getCollection,
} from "@/server/collection/collection";
import { getDeckHoldings } from "@/server/decks/copies";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/collection">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "CollectionPage",
  });
  return { title: t("title") };
}

const searchSchema = z.object({
  q: z.string().max(100).catch(""),
  sort: z.enum(COLLECTION_SORTS).catch("name"),
  show: z.enum(COLLECTION_SHOWS).catch("all"),
});

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/collection">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { user } = await requireSession(locale as Locale, "/collection");
  const t = await getTranslations("CollectionPage");
  const tBinders = await getTranslations("Binders");
  const format = await getFormatter();
  const raw = await searchParams;
  // Filtres de la recherche de cartes (couleurs, types…), sans son nom ni
  // son tri : la collection a les siens.
  const filters = parseCardSearch({
    ...raw,
    q: undefined,
    sort: undefined,
    page: undefined,
  });
  const filtering = activeFilters(filters).length > 0;
  const [collection, holdings, binderList, splits, matching, sets] =
    await Promise.all([
      getCollection(user.id),
      getDeckHoldings(user.id),
      listBinders(user.id),
      getBinderSplits(user.id),
      filtering ? filterCollection(user.id, filters) : null,
      getSets(filters.sets),
    ]);
  const currency = locale === "en" ? "USD" : "EUR";
  const { q, sort, show } = searchSchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    sort: typeof raw.sort === "string" ? raw.sort : "name",
    show: typeof raw.show === "string" ? raw.show : "all",
  });
  // Un classeur supprimé entre-temps : on montre toute la collection.
  const parsedView = parseBinderView(raw.binder);
  const view =
    typeof parsedView === "object" &&
    !binderList.some((binder) => binder.id === parsedView.id)
      ? "all"
      : parsedView;
  const viewKey: BinderViewKey = typeof view === "string" ? view : view.id;
  const inView = (entry: { oracleId: string; quantity: number }) =>
    copiesInView(entry.quantity, splits[entry.oracleId] ?? {}, view);
  const binders = binderList.map((binder) => ({
    ...binder,
    count: collection.entries.reduce(
      (sum, entry) => sum + (splits[entry.oracleId]?.[binder.id] ?? 0),
      0,
    ),
  }));
  const binderCounts = {
    all: collection.total,
    none: collection.entries.reduce(
      (sum, entry) =>
        sum + unsortedCopies(entry.quantity, splits[entry.oracleId] ?? {}),
      0,
    ),
  };
  const viewEntries = collection.entries.filter((entry) => inView(entry) > 0);
  // Paramètres de chaque réglage, pour que les autres les gardent.
  const binderQuery: Record<string, string> =
    viewKey === "all" ? {} : { binder: viewKey };
  const listQuery: Record<string, string> = {
    ...(q && { q }),
    ...(sort !== "name" && { sort }),
    ...(show !== "all" && { show }),
  };
  const { page: _page, ...filterQuery } = cardSearchToQuery(filters);
  // Où sont les exemplaires de chaque carte, et l'état de chaque deck.
  const usage = Object.fromEntries(
    collection.entries.map((entry) => [
      entry.oracleId,
      cardUsage(entry.oracleId, entry.quantity, holdings),
    ]),
  );
  const decks: Record<string, DeckInfo> = Object.fromEntries(
    holdings.map((holding) => [
      holding.deckId,
      {
        name: holding.name,
        status: deckStatus(holding.assembled, holding.needs, holding.copies),
      },
    ]),
  );
  const shown = selectCollection(viewEntries, {
    query: q,
    sort,
    currency,
  }).filter((entry) => {
    if (matching && !matching.has(entry.oracleId)) return false;
    const { used, free, missing } = usage[entry.oracleId];
    if (show === "free") return free > 0;
    if (show === "used") return used > 0;
    if (show === "missing") return missing > 0;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground" data-testid="collection-count">
            {t("count", { count: collection.total })}
            {collection.total > 0 && (
              <>
                {" · "}
                {t("distinct", { count: collection.entries.length })}
                {" · "}
                {t("value", {
                  value: format.number(
                    currency === "EUR"
                      ? collection.priceEur
                      : collection.priceUsd,
                    { style: "currency", currency },
                  ),
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CollectionImport
            binders={binderList}
            defaultBinder={typeof view === "object" ? view.id : null}
          />
          {collection.entries.length > 0 && (
            <CollectionExport
              entries={collection.entries.map(({ name, quantity }) => ({
                name,
                quantity,
              }))}
            />
          )}
          {/* Sur téléphone, le scan se fait directement sur l'appareil. */}
          <Link
            href="/scan"
            className={buttonVariants({ className: "sm:hidden" })}
          >
            <Camera aria-hidden />
            {t("scanHere")}
          </Link>
          <PhoneScan />
        </div>
      </div>

      <PendingScans />

      <AddCollectionCard />

      {collection.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="font-medium">{t("empty")}</p>
          <p className="mt-1 text-muted-foreground text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="max-md:hidden">
            <BinderNav
              binders={binders}
              counts={binderCounts}
              view={viewKey}
              query={{ ...listQuery, ...filterQuery }}
            />
          </aside>
          <div className="min-w-0 space-y-4">
            <div className="max-md:sr-only">
              <h2 className="font-semibold text-xl">
                {viewKey === "all"
                  ? tBinders("all")
                  : viewKey === "none"
                    ? tBinders("unsorted")
                    : binders.find((binder) => binder.id === viewKey)?.name}
              </h2>
              <p
                className="text-muted-foreground text-sm"
                data-testid="binder-count"
              >
                {tBinders("viewCount", {
                  count: viewEntries.reduce(
                    (sum, entry) => sum + inView(entry),
                    0,
                  ),
                  distinct: viewEntries.length,
                })}
              </p>
            </div>
            <BinderSelect
              binders={binders}
              counts={binderCounts}
              view={viewKey}
              query={{ ...listQuery, ...filterQuery }}
            />
            <CollectionFilters
              query={q}
              sort={sort}
              show={show}
              keep={{ ...binderQuery, ...filterQuery }}
            />
            <CardSearchForm
              search={filters}
              sets={sets}
              filtersOnly
              pathname="/collection"
              keep={{ ...listQuery, ...binderQuery }}
              action={getPathname({
                locale: locale as Locale,
                href: "/collection",
              })}
            />
            <ActiveFilters
              search={filters}
              sets={sets}
              pathname="/collection"
              keep={{ ...listQuery, ...binderQuery }}
            />
            {shown.length === 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {q
                    ? t("noMatch", { query: q })
                    : filtering
                      ? t("noFilterMatch")
                      : viewEntries.length === 0
                        ? tBinders(
                            viewKey === "none"
                              ? "emptyUnsorted"
                              : "emptyBinder",
                          )
                        : t("noShown")}
                </p>
                {filtering && (
                  <Link
                    href={{
                      pathname: "/collection",
                      query: { ...listQuery, ...binderQuery },
                    }}
                    className="text-primary text-sm underline-offset-4 hover:underline"
                  >
                    {t("clearFilters")}
                  </Link>
                )}
              </div>
            ) : q ? (
              // Une recherche montre le détail : decks, exemplaires, classeurs.
              <CollectionDetails
                entries={shown}
                usage={usage}
                decks={decks}
                binders={binderList}
                splits={splits}
                from={pageWithQuery("collection", {
                  ...listQuery,
                  ...binderQuery,
                })}
              />
            ) : (
              <CollectionGrid
                entries={shown}
                usage={usage}
                binders={binderList}
                splits={splits}
                view={view}
                keep={binderQuery}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
