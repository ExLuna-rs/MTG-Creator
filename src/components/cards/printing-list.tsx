"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { type Printing, printingPrice } from "@/domain/cards/printing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Versions affichées avant « Voir toutes les versions ». */
const FIRST_SHOWN = 12;

export const PRINTING_SORTS = ["newest", "oldest", "price"] as const;
type PrintingSort = (typeof PRINTING_SORTS)[number];

/** Code, numéro de collection et année d'une édition : « CMM · 410 · 2023 ». */
export function printingCode(
  printing: Pick<Printing, "setCode" | "collectorNumber" | "releasedAt">,
) {
  return `${printing.setCode.toUpperCase()} · ${printing.collectorNumber} · ${printing.releasedAt.slice(0, 4)}`;
}

/**
 * Versions d'une carte sur sa fiche : chacune est un lien vers la fiche qui
 * l'affiche (paramètre `v`), triables, versions spéciales masquables.
 */
export function PrintingList({
  printings,
  selectedId,
  name,
  oracleId,
  from,
  currency,
}: {
  printings: readonly Printing[];
  selectedId: string;
  name: string;
  oracleId: string;
  /** Page où ramène le lien « Retour », gardée d'une version à l'autre. */
  from?: string;
  currency: "EUR" | "USD";
}) {
  const t = useTranslations("CardPage");
  const format = useFormatter();
  const id = useId();
  const [sort, setSort] = useState<PrintingSort>("newest");
  const hasNormal = printings.some((printing) => !printing.special);
  const [hideSpecial, setHideSpecial] = useState(hasNormal);
  const [expanded, setExpanded] = useState(false);

  const shown = useMemo(() => {
    const price = (printing: Printing) =>
      printingPrice(printing, currency) ?? Number.POSITIVE_INFINITY;
    const list = printings.filter(
      (printing) =>
        !hideSpecial || !printing.special || printing.id === selectedId,
    );
    if (sort === "oldest") return [...list].reverse();
    if (sort === "price") return [...list].sort((a, b) => price(a) - price(b));
    return list;
  }, [printings, hideSpecial, sort, currency, selectedId]);
  const visible = expanded ? shown : shown.slice(0, FIRST_SHOWN);

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="font-semibold text-lg">
          {t("versions", { count: printings.length })}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="sr-only">{t("versionSort")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as PrintingSort)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {PRINTING_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(`versionSorts.${value}`)}
                </option>
              ))}
            </select>
          </label>
          {hasNormal && (
            <label className="flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={hideSpecial}
                onChange={(event) => setHideSpecial(event.target.checked)}
                className="size-4 accent-primary"
              />
              {t("hideSpecial")}
            </label>
          )}
        </div>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {visible.map((printing) => {
          const current = printing.id === selectedId;
          const price = printingPrice(printing, currency);
          return (
            <li key={printing.id}>
              <Link
                href={`/cards/${oracleId}?${new URLSearchParams({
                  v: printing.id,
                  ...(from && { from }),
                })}`}
                replace
                scroll={false}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "grid h-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2.5 rounded-lg border bg-card p-2 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current && "border-primary ring-2 ring-primary/20",
                )}
              >
                <CardImage
                  imageUris={printing.imageUris}
                  name={name}
                  decorative
                  sizes="44px"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {printing.setName}
                  </span>
                  <span className="block truncate font-mono text-muted-foreground text-xs">
                    {printingCode(printing)}
                  </span>
                  <span className="block font-semibold tabular-nums">
                    {price === null
                      ? t("priceUnavailable")
                      : format.number(price, { style: "currency", currency })}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length > FIRST_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          {expanded
            ? t("showFewerVersions")
            : t("showAllVersions", { count: shown.length })}
        </button>
      )}
    </section>
  );
}
