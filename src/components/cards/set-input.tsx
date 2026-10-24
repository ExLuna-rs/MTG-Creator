"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { MAX_SETS } from "@/domain/cards/search-query";
import { cn } from "@/lib/utils";

/** Extension proposée ou choisie. */
export interface SetOption {
  code: string;
  name: string;
  releasedAt: string;
}

const DEBOUNCE_MS = 150;

/**
 * Choix d'extensions : un champ avec suggestions par nom ou par code (motif
 * combobox de l'ARIA) et les extensions choisies en pastilles, envoyées par
 * des champs cachés. Sans JavaScript, la saisie est envoyée comme un code.
 */
export function SetInput({
  id,
  values,
  onValuesChange,
  text,
  onTextChange,
  className,
}: {
  id: string;
  values: SetOption[];
  onValuesChange: (values: SetOption[]) => void;
  /** Saisie en cours. */
  text: string;
  onTextChange: (text: string) => void;
  className?: string;
}) {
  const t = useTranslations("CardSearch");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SetOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const full = values.length >= MAX_SETS;

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/cards/sets?${new URLSearchParams({ q: query })}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data: { sets: SetOption[] } = await response.json();
        setSuggestions(data.sets);
        setActive(-1);
      } catch {
        // Saisie suivante ou réseau indisponible : rien à proposer.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const shown = query.trim()
    ? suggestions.filter(
        (suggestion) => !values.some((value) => value.code === suggestion.code),
      )
    : [];
  const expanded = open && shown.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function add(set: SetOption) {
    close();
    onTextChange("");
    setQuery("");
    if (full || values.some((value) => value.code === set.code)) return;
    onValuesChange([...values, set]);
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
        // Seule une extension connue peut être ajoutée : la suggestion
        // choisie, sinon la première.
        if (count > 0) add(shown[expanded && active >= 0 ? active : 0]);
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
          // Sans JavaScript, la saisie part comme un code d'extension.
          name="set"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={
            expanded && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          disabled={full}
          placeholder={t("setsPlaceholder")}
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
          aria-label={t("setSuggestions")}
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-card py-1 text-card-foreground shadow-lg"
        >
          {shown.map((suggestion, index) => (
            // Clavier géré par le champ (aria-activedescendant).
            // biome-ignore lint/a11y/useKeyWithClickEvents: motif combobox de l'ARIA
            <div
              key={suggestion.code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(suggestion)}
              onMouseMove={() => setActive(index)}
              className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <span className="min-w-0 truncate">{suggestion.name}</span>
              <span className="shrink-0 font-mono text-muted-foreground text-xs uppercase tabular-nums">
                {suggestion.code} · {suggestion.releasedAt.slice(0, 4)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value.code}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 py-0.5 pr-1 pl-3 text-sm"
            >
              <input type="hidden" name="set" value={value.code} />
              <span className="truncate">{value.name}</span>
              <button
                type="button"
                onClick={() =>
                  onValuesChange(
                    values.filter((item) => item.code !== value.code),
                  )
                }
                aria-label={t("removeSet", { name: value.name })}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
