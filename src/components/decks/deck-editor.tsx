"use client";

import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { validateCommanderDeck } from "@/domain/commander/validate";
import type { DeckCard, DeckCardData, DeckEntry } from "@/domain/deck/deck";
import { createEditorState, editorReducer } from "@/domain/deck/editor";
import { GROUP_MODES, type GroupMode } from "@/domain/deck/groups";
import { computeDeckStats } from "@/domain/deck/stats";
import { mergeImport } from "@/domain/import-export/import";
import { cn } from "@/lib/utils";
import { deleteDeckAction } from "@/server/decks/actions";
import { CardPreview } from "./card-preview";
import { CardSpotlight } from "./card-spotlight";
import {
  DeckAssemblyNotice,
  DeckAssemblyToggle,
  type DeckOwnershipData,
  OwnershipProvider,
  useDeckOwnership,
} from "./deck-assembly";
import { DECK_VIEWS, DeckBoard, type DeckView } from "./deck-board";
import { DeckImport } from "./deck-import";
import { DeckStats } from "./deck-stats";
import { type SaveStatus, useAutosave } from "./use-autosave";
import { ValidationPanel } from "./validation-panel";

/** Affichage et regroupement choisis, gardés dans le navigateur (simple confort). */
const VIEW_STORAGE_KEY = "deck-editor-view";
const MODE_STORAGE_KEY = "deck-editor-group-mode";

function stored<T extends string>(
  key: string,
  allowed: readonly T[],
): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.find((item) => item === value) ?? null;
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la page.
  }
}

/** Éléments où Ctrl+Z doit garder son sens habituel (annuler la saisie). */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Éditeur d'un deck Commander : validation et statistiques en bandeau, puis
 * le deck en piles, en grille ou en liste (avec l'aperçu de la carte
 * survolée à droite). La recherche s'ouvre façon Spotlight (Ctrl+K). Chaque
 * modification est enregistrée automatiquement et peut être annulée.
 */
export function DeckEditor({
  deckId,
  name,
  entries,
  cards,
  ownership,
  defaultCategories,
}: {
  deckId: string;
  name: string;
  entries: DeckEntry[];
  cards: DeckCardData[];
  ownership: DeckOwnershipData;
  defaultCategories: string[];
}) {
  const t = useTranslations("DeckEditor");
  const [state, dispatch] = useReducer(editorReducer, null, () =>
    createEditorState({ name, entries }, cards),
  );
  const [mode, setMode] = useState<GroupMode>("role");
  const [view, setView] = useState<DeckView>("piles");
  const [preview, setPreview] = useState<DeckCardData | null>(null);
  const { status, retry } = useAutosave(deckId, state.present);

  const deck = useMemo<DeckCard[]>(
    () =>
      state.present.entries.flatMap((entry) => {
        const card = state.cards[entry.oracleId];
        return card ? [{ ...entry, card }] : [];
      }),
    [state.present.entries, state.cards],
  );
  const validation = useMemo(() => validateCommanderDeck(deck), [deck]);
  const stats = useMemo(() => computeDeckStats(deck), [deck]);
  const commanders = deck.filter((entry) => entry.zone === "commander");

  const quantities = useMemo(() => {
    const result: Record<string, number> = {};
    for (const entry of deck) {
      if (entry.zone !== "maybe") {
        result[entry.oracleId] = (result[entry.oracleId] ?? 0) + entry.quantity;
      }
    }
    return result;
  }, [deck]);

  const owning = useDeckOwnership({
    deckId,
    ownership,
    needs: quantities,
    saved: status === "saved",
  });

  const categories = useMemo(
    () => [
      ...new Set([
        ...deck.flatMap((entry) => entry.categories),
        ...defaultCategories,
      ]),
    ],
    [deck, defaultCategories],
  );

  // Affichage et regroupement choisis lors d'une visite précédente.
  useEffect(() => {
    const storedView = stored(VIEW_STORAGE_KEY, DECK_VIEWS);
    if (storedView) setView(storedView);
    const storedMode = stored(MODE_STORAGE_KEY, GROUP_MODES);
    if (storedMode) setMode(storedMode);
  }, []);

  function changeView(value: DeckView) {
    setView(value);
    store(VIEW_STORAGE_KEY, value);
  }

  function changeMode(value: GroupMode) {
    setMode(value);
    store(MODE_STORAGE_KEY, value);
  }

  // Raccourcis Annuler / Rétablir, hors des champs de saisie.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || isEditable(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const previewCard = preview ?? commanders[0]?.card ?? null;

  return (
    <OwnershipProvider value={owning.context}>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <DeckName
            key={state.present.name}
            name={state.present.name}
            onRename={(value) => dispatch({ type: "rename", name: value })}
          />
          <SaveIndicator status={status} onRetry={retry} />
          <DeckAssemblyToggle state={owning} />
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <DeckImport
              onImport={(imported, importedCards, replace) =>
                dispatch({
                  type: "import",
                  entries: mergeImport(
                    state.present.entries,
                    imported,
                    {
                      ...state.cards,
                      ...Object.fromEntries(
                        importedCards.map((card) => [card.oracleId, card]),
                      ),
                    },
                    { replace },
                  ),
                  cards: importedCards,
                })
              }
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => dispatch({ type: "undo" })}
              disabled={state.past.length === 0}
              aria-label={t("undo")}
              title={t("undoShortcut")}
            >
              <Undo2 aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => dispatch({ type: "redo" })}
              disabled={state.future.length === 0}
              aria-label={t("redo")}
              title={t("redoShortcut")}
            >
              <Redo2 aria-hidden />
            </Button>
            <form
              action={deleteDeckAction}
              onSubmit={(event) => {
                if (!window.confirm(t("deleteConfirm"))) event.preventDefault();
              }}
            >
              <input type="hidden" name="deckId" value={deckId} />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label={t("delete")}
                title={t("delete")}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </form>
          </div>
        </header>

        <DeckAssemblyNotice state={owning} cards={state.cards} />

        <div className="grid gap-6 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <ValidationPanel validation={validation} />
          <DeckStats stats={stats} />
        </div>

        <div
          className={cn(
            "grid items-start gap-6",
            view === "list" && "lg:grid-cols-[minmax(0,1fr)_18rem]",
          )}
        >
          <section aria-labelledby="deck-title" className="min-w-0 space-y-4">
            <h2 id="deck-title" className="sr-only">
              {t("deckTitle", { count: validation.size })}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <CardSpotlight
                identity={
                  commanders.length > 0 ? validation.colorIdentity : null
                }
                quantities={quantities}
                onAdd={(card, zone, quantity) =>
                  dispatch({ type: "add", card, zone, quantity })
                }
              />
              <Toggle
                legend={t("display")}
                values={DECK_VIEWS}
                value={view}
                label={(value) => t(`views.${value}`)}
                onChange={changeView}
              />
              <Toggle
                legend={t("groupBy")}
                values={GROUP_MODES}
                value={mode}
                label={(value) => t(`groupModes.${value}`)}
                onChange={changeMode}
              />
            </div>
            <DeckBoard
              deck={deck}
              view={view}
              mode={mode}
              cardIssues={validation.cardIssues}
              categories={categories}
              dispatch={dispatch}
              onPreview={setPreview}
            />
          </section>

          {view === "list" && previewCard && (
            <aside className="hidden lg:sticky lg:top-4 lg:block">
              <CardPreview card={previewCard} />
            </aside>
          )}
        </div>
      </div>
    </OwnershipProvider>
  );
}

/** Boutons à choix unique (affichage, regroupement). */
function Toggle<T extends string>({
  legend,
  values,
  value,
  label,
  onChange,
}: {
  legend: string;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
      <legend className="sr-only">{legend}</legend>
      {values.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className="rounded-md px-2.5 py-1 aria-pressed:bg-background aria-pressed:shadow-xs"
        >
          {label(item)}
        </button>
      ))}
    </fieldset>
  );
}

/** Nom du deck, modifiable ; enregistré en quittant le champ. */
function DeckName({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const t = useTranslations("DeckEditor");
  const [value, setValue] = useState(name);

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onRename(trimmed);
    else setValue(name);
  }

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setValue(name);
          event.currentTarget.blur();
        }
      }}
      maxLength={100}
      aria-label={t("deckName")}
      className="min-w-0 flex-1 basis-full rounded-md border border-transparent sm:basis-auto bg-transparent px-2 py-1 font-semibold text-2xl tracking-tight outline-none hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  const t = useTranslations("DeckEditor");
  return (
    <span
      role="status"
      className="flex items-center gap-1.5 text-muted-foreground text-sm"
    >
      {status === "saved" && (
        <>
          <CircleCheck className="size-4" aria-hidden />
          {t("saved")}
        </>
      )}
      {(status === "pending" || status === "saving") && (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("saving")}
        </>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1.5 text-destructive">
          <CircleAlert className="size-4" aria-hidden />
          {t("saveError")}
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={onRetry}
          >
            {t("retry")}
          </Button>
        </span>
      )}
    </span>
  );
}
