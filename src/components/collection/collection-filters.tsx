"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  COLLECTION_SORTS,
  type CollectionSort,
} from "@/domain/collection/collection";
import { useRouter } from "@/i18n/navigation";

const DEBOUNCE_MS = 250;

/** Recherche par nom et tri de la collection, gardés dans l'adresse de la page. */
export function CollectionFilters({
  query,
  sort,
}: {
  query: string;
  sort: CollectionSort;
}) {
  const t = useTranslations("CollectionPage");
  const tSort = useTranslations("CollectionSorts");
  const router = useRouter();
  const searchId = useId();
  const sortId = useId();
  const [value, setValue] = useState(query);

  function go(next: { q: string; sort: CollectionSort }) {
    const params: Record<string, string> = {};
    if (next.q.trim()) params.q = next.q.trim();
    if (next.sort !== "name") params.sort = next.sort;
    router.replace(
      { pathname: "/collection", query: params },
      { scroll: false },
    );
  }

  // Recherche après une courte pause de frappe.
  useEffect(() => {
    if (value.trim() === query) return;
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
    </div>
  );
}
