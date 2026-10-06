"use client";

import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface Suggestion {
  oracleId: string;
  name: string;
}

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 150;

/**
 * Champ « nom de la carte » avec suggestions, selon le motif combobox de
 * l'ARIA : le focus reste dans le champ, les flèches parcourent la liste,
 * Entrée ouvre la carte choisie (ou lance la recherche si aucune ne l'est).
 * Sans JavaScript, c'est un simple champ de formulaire.
 */
export function CardNameInput({
  id,
  name,
  value,
  onValueChange,
  placeholder,
  suggestionsLabel,
  onSelect,
  className,
}: {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  suggestionsLabel: string;
  /** Carte choisie dans les suggestions ; par défaut, sa fiche s'ouvre. */
  onSelect?: (suggestion: Suggestion) => void;
  className?: string;
}) {
  const router = useRouter();
  const listId = useId();
  // Dernière saisie au clavier : seule elle déclenche des suggestions.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Suggestions de la dernière saisie, après une courte pause de frappe.
  useEffect(() => {
    if (query.trim().length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/cards/suggest?${new URLSearchParams({ q: query })}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data: { cards: Suggestion[] } = await response.json();
        setSuggestions(data.cards);
        setActive(-1);
      } catch {
        // Requête annulée par une nouvelle saisie, ou réseau indisponible :
        // les suggestions sont un confort, la recherche reste possible.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Une saisie trop courte n'a pas de suggestions (même les précédentes).
  const shown = query.trim().length < MIN_LENGTH ? [] : suggestions;
  const expanded = open && shown.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function openCard(suggestion: Suggestion) {
    close();
    if (onSelect) {
      onSelect(suggestion);
      return;
    }
    onValueChange(suggestion.name);
    router.push(`/cards/${suggestion.oracleId}`);
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
        if (expanded && active >= 0) {
          event.preventDefault();
          openCard(shown[active]);
        } else {
          // Le formulaire est envoyé : la liste n'a plus lieu d'être.
          close();
        }
        break;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={100}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
      />
      <div
        id={listId}
        role="listbox"
        aria-label={suggestionsLabel}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-card py-1 text-card-foreground shadow-lg"
      >
        {shown.map((suggestion, index) => (
          // Le clavier est géré par le champ (aria-activedescendant) : les
          // options ne reçoivent que la souris.
          // biome-ignore lint/a11y/useKeyWithClickEvents: motif combobox de l'ARIA
          <div
            key={suggestion.oracleId}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            // Garde le focus dans le champ pendant le clic.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openCard(suggestion)}
            onMouseMove={() => setActive(index)}
            className="cursor-pointer px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            {suggestion.name}
          </div>
        ))}
      </div>
    </div>
  );
}
