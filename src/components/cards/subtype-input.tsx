"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { MAX_SUBTYPES } from "@/domain/cards/search-query";
import { cn } from "@/lib/utils";

interface SubtypeSuggestion {
  name: string;
  count: number;
}

const DEBOUNCE_MS = 150;

const sameSubtype = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/**
 * Choix de sous-types : un champ avec suggestions (motif combobox de l'ARIA)
 * et les sous-types choisis en pastilles, envoyés par des champs cachés.
 * Entrée ajoute la suggestion choisie, ou la saisie telle quelle. Sans
 * JavaScript, la saisie est envoyée comme un sous-type.
 */
export function SubtypeInput({
  id,
  values,
  onValuesChange,
  text,
  onTextChange,
  className,
}: {
  id: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  /** Saisie en cours, ajoutée à la recherche si elle est envoyée telle quelle. */
  text: string;
  onTextChange: (text: string) => void;
  className?: string;
}) {
  const t = useTranslations("CardSearch");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SubtypeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const full = values.length >= MAX_SUBTYPES;

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/cards/subtypes?${new URLSearchParams({ q: query })}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data: { subtypes: SubtypeSuggestion[] } = await response.json();
        setSuggestions(data.subtypes);
        setActive(-1);
      } catch {
        // Saisie suivante ou réseau indisponible : la saisie libre reste possible.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const shown = query.trim()
    ? suggestions.filter(
        (suggestion) =>
          !values.some((value) => sameSubtype(value, suggestion.name)),
      )
    : [];
  const expanded = open && shown.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function add(value: string) {
    const subtype = value.trim();
    close();
    onTextChange("");
    setQuery("");
    if (!subtype || full || values.some((item) => sameSubtype(item, subtype))) {
      return;
    }
    onValuesChange([...values, subtype]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = shown.length;
    switch (event.key) {
      case "ArrowDown":
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setActive((index) => (expanded ? (index + 1) % count : 0));
        break;
      case "ArrowUp":
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setActive((index) => (expanded && index > 0 ? index - 1 : count - 1));
        break;
      case "Enter":
        // Champ vide : Entrée lance la recherche, comme ailleurs.
        if (!text.trim()) return;
        event.preventDefault();
        add(expanded && active >= 0 ? shown[active].name : text);
        break;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          close();
        }
        break;
      case "Backspace":
        if (!text && values.length > 0) onValuesChange(values.slice(0, -1));
        break;
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative max-w-sm">
        <input
          id={id}
          // Sans JavaScript, la saisie part comme un sous-type de plus.
          name="sub"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={
            expanded && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={40}
          disabled={full}
          placeholder={t("subtypesPlaceholder")}
          value={text}
          onChange={(event) => {
            onTextChange(event.target.value);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm"
        />
        <div
          id={listId}
          role="listbox"
          aria-label={t("subtypeSuggestions")}
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-card py-1 text-card-foreground shadow-lg"
        >
          {shown.map((suggestion, index) => (
            // Clavier géré par le champ (aria-activedescendant).
            // biome-ignore lint/a11y/useKeyWithClickEvents: motif combobox de l'ARIA
            <div
              key={suggestion.name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(suggestion.name)}
              onMouseMove={() => setActive(index)}
              className="flex cursor-pointer justify-between gap-3 px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              {suggestion.name}
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("subtypeCount", { count: suggestion.count })}
              </span>
            </div>
          ))}
        </div>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-0.5 pr-1 pl-3 text-sm"
            >
              <input type="hidden" name="sub" value={value} />
              {value}
              <button
                type="button"
                onClick={() =>
                  onValuesChange(values.filter((item) => item !== value))
                }
                aria-label={t("removeSubtype", { name: value })}
                className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
