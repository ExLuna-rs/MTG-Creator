"use client";

import { Check, LoaderCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { Input } from "@/components/ui/input";
import type { DeckCardData } from "@/domain/deck/deck";
import { cn } from "@/lib/utils";
import { useDebouncedJson } from "./use-card-fetch";

export type CommanderCandidate = DeckCardData & { pairable: boolean };

/**
 * Choix d'un commandant parmi les cartes qui peuvent l'être (ou, avec
 * `pairWith`, parmi les partenaires et Backgrounds de ce commandant).
 */
export function CommanderPicker({
  label,
  pairWith,
  selected,
  onSelect,
}: {
  label: string;
  pairWith?: string;
  selected: CommanderCandidate | null;
  onSelect: (card: CommanderCandidate | null) => void;
}) {
  const t = useTranslations("NewDeck");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const params = new URLSearchParams({ q: query.trim() });
  if (pairWith) params.set("with", pairWith);
  const { data, loading, error } = useDebouncedJson<{
    cards: CommanderCandidate[];
  }>(`/api/cards/commanders?${params}`);
  const cards = data?.cards ?? [];

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block font-medium text-sm">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="pl-9"
        />
        {loading && (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
      {error && <p className="text-destructive text-sm">{t("loadError")}</p>}
      {!loading && !error && cards.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noCandidates")}</p>
      )}
      <ul
        aria-label={t("candidates")}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5"
      >
        {cards.map((card) => {
          const isSelected = selected?.oracleId === card.oracleId;
          return (
            <li key={card.oracleId}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : card)}
                className={cn(
                  "group relative block w-full rounded-lg p-1 text-left outline-none ring-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isSelected && "ring-2 ring-primary",
                )}
              >
                <CardImage
                  imageUris={card.imageUris}
                  name={card.name}
                  decorative
                  sizes="(min-width: 1024px) 160px, (min-width: 640px) 22vw, 45vw"
                />
                <span className="mt-1 flex items-center gap-1 text-sm">
                  {isSelected && (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  )}
                  <span className="truncate font-medium">{card.name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
