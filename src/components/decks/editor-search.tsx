"use client";

import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ManaText } from "@/components/cards/mana-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskToColors } from "@/domain/cards/colors";
import { CARD_TYPES } from "@/domain/cards/type-line";
import type { DeckCardData, DeckZone } from "@/domain/deck/deck";
import { useDebouncedJson } from "./use-card-fetch";

interface SearchResponse {
  cards: DeckCardData[];
  total: number;
  pageCount: number;
}

/**
 * Recherche de cartes dans l'éditeur, limitée par défaut à l'identité couleur
 * du ou des commandants et aux cartes légales en Commander.
 */
export function EditorSearch({
  identity,
  quantities,
  onAdd,
  onPreview,
}: {
  /** Identité des commandants, ou null sans commandant (pas de limite). */
  identity: number | null;
  /** Exemplaires déjà dans le deck, par `oracleId`. */
  quantities: Record<string, number>;
  onAdd: (card: DeckCardData, zone: DeckZone) => void;
  onPreview: (card: DeckCardData) => void;
}) {
  const t = useTranslations("DeckEditor");
  const tTypes = useTranslations("CardTypes");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [limitIdentity, setLimitIdentity] = useState(true);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ legal: "1" });
  if (query.trim()) params.set("q", query.trim());
  if (type) params.set("type", type);
  if (limitIdentity && identity !== null) {
    const colors = maskToColors(identity);
    for (const color of colors.length > 0 ? colors : ["C"]) {
      params.append("color", color);
    }
  }
  if (page > 1) params.set("page", String(page));
  const { data, loading, error } = useDebouncedJson<SearchResponse>(
    `/api/cards/search?${params}`,
  );

  function update(change: () => void) {
    change();
    setPage(1);
  }

  return (
    <section aria-labelledby="editor-search-title" className="space-y-3">
      <h2 id="editor-search-title" className="font-semibold">
        {t("searchTitle")}
      </h2>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => update(() => setQuery(event.target.value))}
          autoComplete="off"
          spellCheck={false}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          aria-label={t("typeFilter")}
          value={type}
          onChange={(event) => update(() => setType(event.target.value))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{t("allTypes")}</option>
          {CARD_TYPES.map((value) => (
            <option key={value} value={value}>
              {tTypes(value)}
            </option>
          ))}
        </select>
        {identity !== null && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={limitIdentity}
              onChange={(event) =>
                update(() => setLimitIdentity(event.target.checked))
              }
              className="size-4 accent-primary"
            />
            {t("limitIdentity")}
          </label>
        )}
      </div>

      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span aria-live="polite">
          {data && !loading ? t("resultCount", { count: data.total }) : null}
        </span>
        {loading && (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-label={t("loading")}
          />
        )}
      </div>
      {error && <p className="text-destructive text-sm">{t("searchError")}</p>}

      <ul
        aria-label={t("searchResults")}
        className="divide-y rounded-md border lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto"
      >
        {data?.cards.map((card) => {
          const quantity = quantities[card.oracleId] ?? 0;
          return (
            <li
              key={card.oracleId}
              className="flex items-center gap-2 px-2 py-1.5"
              onMouseEnter={() => onPreview(card)}
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onFocus={() => onPreview(card)}
                  onClick={() => onPreview(card)}
                  className="block max-w-full truncate rounded-sm text-left font-medium text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {card.name}
                </button>
                <span className="block truncate text-muted-foreground text-xs">
                  {card.typeLine}
                </span>
              </div>
              {card.manaCost && (
                <span className="shrink-0 text-xs">
                  <ManaText text={card.manaCost} />
                </span>
              )}
              {quantity > 0 && (
                <span
                  className="shrink-0 rounded-full bg-secondary px-1.5 text-secondary-foreground text-xs tabular-nums"
                  title={t("inDeck", { count: quantity })}
                >
                  ×{quantity}
                </span>
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => onAdd(card, "main")}
                aria-label={t("addToDeck", { name: card.name })}
                title={t("addToDeck", { name: card.name })}
              >
                <Plus aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => onAdd(card, "maybe")}
                aria-label={t("addToMaybe", { name: card.name })}
                title={t("addToMaybe", { name: card.name })}
              >
                {t("maybeShort")}
              </Button>
            </li>
          );
        })}
      </ul>

      {data && data.pageCount > 1 && (
        <nav
          aria-label={t("searchPagination")}
          className="flex items-center justify-between"
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden />
            {t("previousPage")}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t("pageOf", { page, pageCount: data.pageCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= data.pageCount}
            onClick={() => setPage(page + 1)}
          >
            {t("nextPage")}
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}
    </section>
  );
}
