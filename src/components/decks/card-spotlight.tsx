"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ManaText } from "@/components/cards/mana-text";
import { maskToColors } from "@/domain/cards/colors";
import type { DeckCardData, DeckZone } from "@/domain/deck/deck";
import { parseQuickAdd } from "@/domain/deck/quick-add";
import { cn } from "@/lib/utils";
import { CardPreview } from "./card-preview";
import { useDebouncedJson } from "./use-card-fetch";

/** Nombre de résultats affichés. */
const RESULT_COUNT = 12;

interface SearchResponse {
  cards: DeckCardData[];
}

/** Éléments où « / » doit s'écrire normalement. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Recherche de cartes façon Spotlight : Ctrl+K (⌘K sur Mac) ou « / » ouvre
 * une fenêtre au centre ; on tape, on choisit avec les flèches, Entrée
 * ajoute la carte au deck et Maj+Entrée aux cartes à considérer. La fenêtre
 * reste ouverte pour enchaîner ; Échap la ferme. La recherche est limitée
 * par défaut à l'identité couleur des commandants et aux cartes légales.
 */
export function CardSpotlight({
  identity,
  quantities,
  onAdd,
}: {
  /** Identité des commandants, ou null sans commandant (pas de limite). */
  identity: number | null;
  /** Exemplaires déjà dans le deck, par `oracleId`. */
  quantities: Record<string, number>;
  onAdd: (card: DeckCardData, zone: DeckZone, quantity: number) => void;
}) {
  const t = useTranslations("CardSpotlight");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const [limitIdentity, setLimitIdentity] = useState(true);
  const [added, setAdded] = useState<string | null>(null);

  const { quantity, query } = parseQuickAdd(value);
  const params = new URLSearchParams({ legal: "1" });
  if (query) params.set("q", query);
  if (limitIdentity && identity !== null) {
    const colors = maskToColors(identity);
    for (const color of colors.length > 0 ? colors : ["C"]) {
      params.append("color", color);
    }
  }
  const { data, loading, error } = useDebouncedJson<SearchResponse>(
    open ? `/api/cards/search?${params}` : null,
  );
  const results = data?.cards.slice(0, RESULT_COUNT) ?? [];
  const selected = results[Math.min(active, results.length - 1)] ?? null;

  function show() {
    setValue("");
    setActive(0);
    setAdded(null);
    setOpen(true);
    dialog.current?.showModal();
    input.current?.focus();
  }

  // Raccourcis d'ouverture, depuis n'importe où dans l'éditeur.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut =
        (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) ||
        (event.key === "/" && !isEditable(event.target));
      if (!shortcut || dialog.current?.open) return;
      event.preventDefault();
      show();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function add(card: DeckCardData, maybe: boolean) {
    onAdd(card, maybe ? "maybe" : "main", quantity);
    setAdded(
      t(maybe ? "addedToMaybe" : "addedToDeck", {
        name: card.name,
        count: quantity,
      }),
    );
    setValue("");
    setActive(0);
    input.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      add(selected, event.shiftKey);
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        className="flex h-10 min-w-0 flex-1 basis-64 items-center gap-2 rounded-lg border bg-muted/60 px-3 text-left text-muted-foreground text-sm transition-colors hover:border-ring"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{t("open")}</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-xs sm:inline">
          {t("shortcut")}
        </kbd>
      </button>

      {/* Un clic sur le fond ferme la fenêtre ; au clavier, Échap fait de même. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Échap est géré nativement par <dialog> */}
      <dialog
        ref={dialog}
        aria-label={t("title")}
        // L'événement « close » peut arriver après une réouverture rapide :
        // l'état suit celui de la fenêtre, pas l'événement.
        onClose={(event) => setOpen(event.currentTarget.open)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="mx-auto mt-[12vh] w-[min(48rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label={t("label")}
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={selected ? optionId(active) : undefined}
            aria-autocomplete="list"
            placeholder={t("placeholder")}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none"
          />
          {loading && (
            <LoaderCircle
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              aria-label={t("loading")}
            />
          )}
          <kbd className="hidden rounded border px-1.5 font-mono text-muted-foreground text-xs sm:inline">
            {t("escape")}
          </kbd>
        </div>

        {identity !== null && (
          <div className="border-b px-4 py-2 text-sm">
            <label className="flex w-fit items-center gap-2">
              <input
                type="checkbox"
                checked={limitIdentity}
                onChange={(event) => {
                  setLimitIdentity(event.target.checked);
                  setActive(0);
                }}
                className="size-4 accent-primary"
              />
              {t("limitIdentity")}
            </label>
          </div>
        )}

        <div className="grid h-[min(26rem,55vh)] md:grid-cols-[minmax(0,1fr)_14rem]">
          <div
            id={listId}
            role="listbox"
            aria-label={t("results")}
            className="overflow-y-auto p-1.5"
          >
            {results.map((card, index) => {
              const inDeck = quantities[card.oracleId] ?? 0;
              return (
                // Le clavier est géré par le champ (aria-activedescendant) : les
                // options ne reçoivent que la souris.
                // biome-ignore lint/a11y/useKeyWithClickEvents: motif combobox de l'ARIA
                <div
                  key={card.oracleId}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  aria-label={card.name}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => add(card, event.shiftKey)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                    index === active && "bg-primary text-primary-foreground",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{card.name}</p>
                    <p
                      className={cn(
                        "truncate text-xs",
                        index === active
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {card.typeLine}
                    </p>
                  </div>
                  {inDeck > 0 && (
                    <span className="shrink-0 rounded-full border border-current px-1.5 text-xs tabular-nums opacity-80">
                      {t("inDeck", { count: inDeck })}
                    </span>
                  )}
                  {card.manaCost && (
                    <span className="shrink-0 text-xs">
                      <ManaText text={card.manaCost} />
                    </span>
                  )}
                </div>
              );
            })}
            {!loading && data && results.length === 0 && (
              <p className="px-3 py-6 text-center text-muted-foreground text-sm">
                {t("noResults")}
              </p>
            )}
            {error && (
              <p className="px-3 py-6 text-center text-destructive text-sm">
                {t("error")}
              </p>
            )}
          </div>
          <div className="hidden overflow-y-auto border-l bg-muted/40 p-3 md:block">
            {selected && <CardPreview card={selected} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-muted-foreground text-xs">
          <span>{t("hintNavigate")}</span>
          <span>{t("hintAdd")}</span>
          <span>{t("hintMaybe")}</span>
          <span>{t("hintQuantity")}</span>
          <span role="status" className="ml-auto text-foreground">
            {added}
          </span>
        </div>
      </dialog>
    </>
  );
}
