"use client";

import { ClipboardPaste, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeCardName } from "@/domain/cards/normalize";
import type { DeckCardData, DeckEntry } from "@/domain/deck/deck";
import {
  type DeckListLine,
  MAX_IMPORT_LENGTH,
  type ParsedDeckList,
  parseDeckList,
} from "@/domain/import-export/deck-list";
import {
  importEntries,
  MAX_IMPORT_NAMES,
  uniqueNames,
} from "@/domain/import-export/import";
import { cn } from "@/lib/utils";

interface ResolvedName {
  name: string;
  card: DeckCardData | null;
  suggestions: DeckCardData[];
}

interface Analysis {
  parsed: ParsedDeckList;
  /** Résultats du serveur, par nom normalisé. */
  results: Map<string, ResolvedName>;
}

type Failure = "empty" | "tooMany" | "network";

const PLACEHOLDER = `Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1x Counterspell (CMM) 81 [Interaction]
36 Island`;

/**
 * Import d'une liste de cartes (Moxfield, Archidekt, MTG Arena, MTGO) :
 * le texte est lu, les noms sont reconnus par le serveur, puis un rapport
 * liste les lignes non reconnues, avec des suggestions, avant l'ajout.
 */
export function DeckImport({
  onImport,
}: {
  onImport: (
    entries: DeckEntry[],
    cards: DeckCardData[],
    replace: boolean,
  ) => void;
}) {
  const t = useTranslations("DeckImport");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  /** Suggestion choisie pour une ligne non reconnue, par numéro de ligne. */
  const [choices, setChoices] = useState<Record<number, DeckCardData>>({});
  const [imported, setImported] = useState<number | null>(null);

  function close() {
    dialog.current?.close();
  }

  function reset() {
    setText("");
    setReplace(false);
    setFailure(null);
    setAnalysis(null);
    setChoices({});
  }

  async function analyze() {
    const parsed = parseDeckList(text);
    const names = uniqueNames(parsed.cards);
    if (names.length === 0) return setFailure("empty");
    if (names.length > MAX_IMPORT_NAMES) return setFailure("tooMany");

    setLoading(true);
    setFailure(null);
    try {
      const response = await fetch("/api/cards/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { results } = (await response.json()) as {
        results: ResolvedName[];
      };
      setAnalysis({
        parsed,
        results: new Map(
          results.map((result) => [normalizeCardName(result.name), result]),
        ),
      });
      setChoices({});
    } catch {
      setFailure("network");
    } finally {
      setLoading(false);
    }
  }

  const resolve = (line: DeckListLine): DeckCardData | null =>
    analysis?.results.get(normalizeCardName(line.name))?.card ??
    choices[line.line] ??
    null;

  const report = useMemo(() => {
    if (!analysis) return null;
    const recognized = analysis.parsed.cards.filter(
      (line) =>
        analysis.results.get(normalizeCardName(line.name))?.card ??
        choices[line.line],
    );
    const unknown = analysis.parsed.cards.filter(
      (line) => !analysis.results.get(normalizeCardName(line.name))?.card,
    );
    return {
      cardCount: recognized.reduce((sum, line) => sum + line.quantity, 0),
      unknown,
    };
  }, [analysis, choices]);

  function confirm() {
    if (!analysis || !report) return;
    const entries = importEntries(analysis.parsed.cards, resolve);
    const cards = analysis.parsed.cards.flatMap((line) => {
      const card = resolve(line);
      return card ? [card] : [];
    });
    onImport(entries, cards, replace);
    setImported(report.cardCount);
    close();
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setImported(null);
          dialog.current?.showModal();
        }}
      >
        <ClipboardPaste aria-hidden />
        {t("open")}
      </Button>
      {imported !== null && (
        <span role="status" className="text-muted-foreground text-sm">
          {t("done", { count: imported })}
        </span>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={reset}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-semibold text-lg">
              {t("title")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label={t("close")}
              className="-mt-1 -mr-2"
            >
              <X aria-hidden />
            </Button>
          </div>

          {!analysis || !report ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                analyze();
              }}
            >
              <div className="space-y-1.5">
                <label htmlFor={textId} className="font-medium text-sm">
                  {t("label")}
                </label>
                <textarea
                  id={textId}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={MAX_IMPORT_LENGTH}
                  rows={12}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <p className="text-muted-foreground text-sm">{t("help")}</p>
              </div>

              <fieldset className="space-y-1.5 text-sm">
                <legend className="mb-1.5 font-medium">{t("mode")}</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={!replace}
                    onChange={() => setReplace(false)}
                  />
                  {t("add")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={replace}
                    onChange={() => setReplace(true)}
                  />
                  {t("replace")}
                </label>
              </fieldset>

              {failure && (
                <p role="alert" className="text-destructive text-sm">
                  {t(`errors.${failure}`, { max: MAX_IMPORT_NAMES })}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={loading || !text.trim()}>
                  {loading && (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  )}
                  {t("analyze")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p>{t("recognized", { count: report.cardCount })}</p>

              {(report.unknown.length > 0 ||
                analysis.parsed.invalid.length > 0) && (
                <section className="space-y-2">
                  <h3 className="font-medium">
                    {t("unknownTitle", {
                      count:
                        report.unknown.length + analysis.parsed.invalid.length,
                    })}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("unknownHelp")}
                  </p>
                  <ul className="divide-y rounded-md border text-sm">
                    {report.unknown.map((line) => (
                      <UnknownLine
                        key={line.line}
                        line={line}
                        suggestions={
                          analysis.results.get(normalizeCardName(line.name))
                            ?.suggestions ?? []
                        }
                        chosen={choices[line.line] ?? null}
                        onChoose={(card) =>
                          setChoices((previous) => {
                            const next = { ...previous };
                            if (card) next[line.line] = card;
                            else delete next[line.line];
                            return next;
                          })
                        }
                      />
                    ))}
                    {analysis.parsed.invalid.map((line) => (
                      <li key={line.line} className="px-3 py-2">
                        <LineText line={line.line} text={line.text} />
                        <p className="text-muted-foreground">
                          {t("invalidLine")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {replace && (
                <p className="text-muted-foreground text-sm">
                  {t("replaceWarning")}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setAnalysis(null)}>
                  {t("back")}
                </Button>
                <Button onClick={confirm} disabled={report.cardCount === 0}>
                  {t("confirm", { count: report.cardCount })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function LineText({ line, text }: { line: number; text: string }) {
  const t = useTranslations("DeckImport");
  return (
    <p>
      <span className="text-muted-foreground">{t("line", { line })}</span>{" "}
      <code className="break-all font-mono">{text}</code>
    </p>
  );
}

/** Ligne non reconnue, avec les cartes au nom proche à choisir. */
function UnknownLine({
  line,
  suggestions,
  chosen,
  onChoose,
}: {
  line: DeckListLine;
  suggestions: DeckCardData[];
  chosen: DeckCardData | null;
  onChoose: (card: DeckCardData | null) => void;
}) {
  const t = useTranslations("DeckImport");
  return (
    <li data-line={line.line} className="space-y-1.5 px-3 py-2">
      <LineText line={line.line} text={line.text} />
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{t("didYouMean")}</span>
          {suggestions.map((card) => {
            const selected = chosen?.oracleId === card.oracleId;
            return (
              <button
                key={card.oracleId}
                type="button"
                aria-pressed={selected}
                onClick={() => onChoose(selected ? null : card)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 hover:bg-accent",
                  selected &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {card.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">{t("noSuggestion")}</p>
      )}
    </li>
  );
}
