"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  COLLECTION_SHOWS,
  COLLECTION_SORTS,
  type CollectionShow,
  type CollectionSort,
} from "@/domain/collection/collection";
import { useRouter } from "@/i18n/navigation";

const DEBOUNCE_MS = 250;

/**
 * Recherche par nom et tri de la collection, gardés dans l'adresse de la
 * page avec les autres paramètres (classeur, filtres).
 */
export function CollectionFilters({
  query,
  sort,
  show,
  keep,
}: {
  query: string;
  sort: CollectionSort;
  show: CollectionShow;
  keep: Record<string, string | string[]>;
}) {
  const t = useTranslations("CollectionPage");
  const tSort = useTranslations("CollectionSorts");
  const router = useRouter();
  const searchId = useId();
  const sortId = useId();
  const [value, setValue] = useState(query);
  // Recherche changée hors du champ (clic sur une carte de la grille) :
  // le champ la reprend. Celle envoyée par le champ lui-même ne l'écrase pas,
  // pour ne pas effacer ce qui a été tapé entre-temps.
  const [shownQuery, setShownQuery] = useState(query);
  const [sentQuery, setSentQuery] = useState(query);
  if (query !== shownQuery) {
    setShownQuery(query);
    if (query !== sentQuery) {
      setSentQuery(query);
      setValue(query);
    }
  }

  function go(next: {
    q: string;
    sort: CollectionSort;
    show?: CollectionShow;
  }) {
    const params: Record<string, string | string[]> = { ...keep };
    const nextShow = next.show ?? show;
    if (next.q.trim()) params.q = next.q.trim();
    setSentQuery(next.q.trim());
    if (next.sort !== "name") params.sort = next.sort;
    if (nextShow !== "all") params.show = nextShow;
    router.replace(
      { pathname: "/collection", query: params },
      { scroll: false },
    );
  }

  // Recherche après une courte pause de frappe.
  useEffect(() => {
    // Rien à envoyer si cette recherche est déjà partie (ou affichée).
    if (value.trim() === sentQuery) return;
    const timer = setTimeout(() => go({ q: value, sort }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-1">
        <label htmlFor={searchId} className="font-medium text-sm">
          {t("search")}
        </label>
        <input
          id={searchId}
          type="search"
          value={value}
          maxLength={100}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={sortId} className="font-medium text-sm">
          {t("sort")}
        </label>
        <select
          id={sortId}
          value={sort}
          onChange={(event) =>
            go({ q: value, sort: event.target.value as CollectionSort })
          }
          className="block h-10 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        >
          {COLLECTION_SORTS.map((option) => (
            <option key={option} value={option}>
              {tSort(option)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-1">
        <legend className="mb-1 font-medium text-sm">{t("show")}</legend>
        <div className="flex h-10 flex-wrap items-center gap-1.5">
          {COLLECTION_SHOWS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={show === option}
              onClick={() => go({ q: value, sort, show: option })}
              className="rounded-full border px-3 py-1 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {t(`showOptions.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
