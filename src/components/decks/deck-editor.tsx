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
import { DeckImport } from "./deck-import";
import { DeckList } from "./deck-list";
import { DeckStats } from "./deck-stats";
import { EditorSearch } from "./editor-search";
import { type SaveStatus, useAutosave } from "./use-autosave";
import { ValidationPanel } from "./validation-panel";

const TABS = ["search", "deck", "analysis"] as const;
type Tab = (typeof TABS)[number];

/** Éléments où Ctrl+Z doit garder son sens habituel (annuler la saisie). */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Colonnes latérales sur grand écran : elles restent visibles quand on fait
 * défiler un long deck, avec leur propre défilement si besoin.
 */
const SIDE_PANEL =
  "lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto";

/**
 * Éditeur d'un deck Commander : recherche à gauche, deck au centre,
 * validation et statistiques à droite (onglets sur mobile). Chaque
 * modification est enregistrée automatiquement et peut être annulée.
 */
export function DeckEditor({
  deckId,
  name,
  entries,
  cards,
  defaultCategories,
}: {
  deckId: string;
  name: string;
  entries: DeckEntry[];
  cards: DeckCardData[];
  defaultCategories: string[];
}) {
  const t = useTranslations("DeckEditor");
  const [state, dispatch] = useReducer(editorReducer, null, () =>
    createEditorState({ name, entries }, cards),
  );
  const [mode, setMode] = useState<GroupMode>("type");
  const [tab, setTab] = useState<Tab>("deck");
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

  const categories = useMemo(
    () => [
      ...new Set([
        ...deck.flatMap((entry) => entry.categories),
        ...defaultCategories,
      ]),
    ],
    [deck, defaultCategories],
  );

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
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <DeckName
          key={state.present.name}
          name={state.present.name}
          onRename={(value) => dispatch({ type: "rename", name: value })}
        />
        <SaveIndicator status={status} onRetry={retry} />
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

      <fieldset className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:hidden">
        <legend className="sr-only">{t("panels")}</legend>
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className="rounded-md px-2 py-1.5 font-medium text-sm aria-pressed:bg-background aria-pressed:shadow-xs"
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,20rem)]">
        <div
          className={cn(tab !== "search" && "hidden", "lg:block", SIDE_PANEL)}
        >
          <EditorSearch
            identity={commanders.length > 0 ? validation.colorIdentity : null}
            quantities={quantities}
            onAdd={(card, zone) => dispatch({ type: "add", card, zone })}
            onPreview={setPreview}
          />
        </div>

        <div className={cn(tab !== "deck" && "hidden", "space-y-3 lg:block")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {t("deckTitle", { count: validation.size })}
            </h2>
            <fieldset className="flex gap-1 rounded-md bg-muted p-1 text-sm">
              <legend className="sr-only">{t("groupBy")}</legend>
              {GROUP_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className="rounded-sm px-2 py-0.5 aria-pressed:bg-background aria-pressed:shadow-xs"
                >
                  {t(`groupModes.${value}`)}
                </button>
              ))}
            </fieldset>
          </div>
          <DeckList
            deck={deck}
            mode={mode}
            cardIssues={validation.cardIssues}
            categories={categories}
            dispatch={dispatch}
            onPreview={setPreview}
          />
        </div>

        <aside
          className={cn(
            tab !== "analysis" && "hidden",
            "space-y-8 lg:block",
            SIDE_PANEL,
          )}
        >
          {previewCard && (
            <div className="hidden lg:block">
              <CardPreview card={previewCard} />
            </div>
          )}
          <ValidationPanel validation={validation} />
          <DeckStats stats={stats} />
        </aside>
      </div>
    </div>
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
