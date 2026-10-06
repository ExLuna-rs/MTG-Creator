import { Camera } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { z } from "zod";
import { AddCollectionCard } from "@/components/collection/add-collection-card";
import { CollectionFilters } from "@/components/collection/collection-filters";
import { CollectionGrid } from "@/components/collection/collection-grid";
import { PendingScans } from "@/components/collection/pending-scans";
import { PhoneScan } from "@/components/collection/phone-scan";
import { buttonVariants } from "@/components/ui/button";
import {
  COLLECTION_SORTS,
  selectCollection,
} from "@/domain/collection/collection";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/server/auth/session";
import { getCollection } from "@/server/collection/collection";

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
});

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/collection">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { user } = await requireSession(locale as Locale, "/collection");
  const t = await getTranslations("CollectionPage");
  const format = await getFormatter();
  const collection = await getCollection(user.id);
  const currency = locale === "en" ? "USD" : "EUR";
  const raw = await searchParams;
  const { q, sort } = searchSchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    sort: typeof raw.sort === "string" ? raw.sort : "name",
  });
  const shown = selectCollection(collection.entries, {
    query: q,
    sort,
    currency,
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
        <div className="space-y-4">
          <CollectionFilters query={q} sort={sort} />
          {shown.length === 0 ? (
            <p className="text-muted-foreground">
              {t("noMatch", { query: q })}
            </p>
          ) : (
            <CollectionGrid entries={shown} />
          )}
        </div>
      )}
    </div>
  );
}
