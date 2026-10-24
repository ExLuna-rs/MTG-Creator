"use client";

import { ClipboardPaste, LoaderCircle, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { LineText, UnknownLine } from "@/components/decks/deck-import";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { normalizeCardName } from "@/domain/cards/normalize";
import type { DeckCardData } from "@/domain/deck/deck";
import {
  type CollectionListLine,
  collectionImportEntries,
  MAX_COLLECTION_IMPORT_LENGTH,
  MAX_COLLECTION_IMPORT_LINES,
  type ParsedCollectionList,
  parseCollectionList,
} from "@/domain/import-export/collection-list";
import { MAX_IMPORT_NAMES, uniqueNames } from "@/domain/import-export/import";
import { useRouter } from "@/i18n/navigation";

interface ResolvedName {
  name: string;
  card: DeckCardData | null;
  suggestions: DeckCardData[];
}

interface Analysis {
  parsed: ParsedCollectionList;
  /** Résultats du serveur, par nom normalisé. */
  results: Map<string, ResolvedName>;
}

type Failure = "empty" | "network" | "file" | "unknownBinder";

const PLACEHOLDER = `4 Lightning Bolt
1 Sol Ring (CMM) 410
2x Counterspell
12 Island`;

/** Noms reconnus par lots : le serveur en accepte un nombre limité par requête. */
async function resolveAll(names: string[]): Promise<ResolvedName[]> {
  const results: ResolvedName[] = [];
  for (let start = 0; start < names.length; start += MAX_IMPORT_NAMES) {
    const response = await fetch("/api/cards/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names: names.slice(start, start + MAX_IMPORT_NAMES),
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { results: ResolvedName[] };
    results.push(...data.results);
  }
  return results;
}

/**
 * Import d'une liste dans la collection : liste collée ou fichier exporté
 * d'une autre application (texte, ou CSV de Moxfield, ManaBox, Archidekt…).
 * Les noms sont reconnus, un rapport liste les lignes non reconnues avec
 * des suggestions, puis les exemplaires s'ajoutent à ceux déjà possédés.
 */
export function CollectionImport({
  binders,
  defaultBinder,
}: {
  /** Classeurs où ranger les exemplaires ajoutés. */
  binders: readonly { id: string; name: string }[];
  /** Classeur affiché, choisi d'avance. */
  defaultBinder: string | null;
}) {
  const t = useTranslations("CollectionImport");
  const tDeck = useTranslations("DeckImport");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const textId = useId();
  const binderId = useId();
  const [binder, setBinder] = useState(defaultBinder ?? "");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [choices, setChoices] = useState<Record<number, DeckCardData>>({});
  const [imported, setImported] = useState<number | null>(null);
  const hideImported = useCallback(() => setImported(null), []);

  function close() {
    dialog.current?.close();
  }

  function reset() {
    setText("");
    setFileName(null);
    setFailure(null);
    setAnalysis(null);
    setChoices({});
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_COLLECTION_IMPORT_LENGTH) return setFailure("file");
    try {
      setText(await file.text());
      setFileName(file.name);
      setFailure(null);
    } catch {
      setFailure("file");
    }
  }

  async function analyze() {
    const parsed = parseCollectionList(text);
    const names = uniqueNames(parsed.cards);
    if (names.length === 0) return setFailure("empty");

    setLoading(true);
    setFailure(null);
    try {
      const results = await resolveAll(names);
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

  const resolve = (line: CollectionListLine): DeckCardData | null =>
    analysis?.results.get(normalizeCardName(line.name))?.card ??
    choices[line.line] ??
    null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolve ne dépend que d'analysis et choices
  const report = useMemo(() => {
    if (!analysis) return null;
    const entries = collectionImportEntries(
      analysis.parsed.cards,
      (line) => resolve(line)?.oracleId ?? null,
    );
    return {
      entries,
      copies: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      unknown: analysis.parsed.cards.filter(
        (line) => !analysis.results.get(normalizeCardName(line.name))?.card,
      ),
    };
  }, [analysis, choices]);

  async function confirm() {
    if (!report || report.entries.length === 0) return;
    setLoading(true);
    setFailure(null);
    try {
      const response = await fetch("/api/collection/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: report.entries,
          ...(binder && { binderId: binder }),
        }),
      });
      if (response.status === 400) {
        const { error } = (await response.json()) as { error?: string };
        if (error === "unknownBinder") {
          setBinder("");
          router.refresh();
          return setFailure("unknownBinder");
        }
      }
      if (!response.ok) throw new Error(String(response.status));
      const { copies } = (await response.json()) as { copies: number };
      setImported(copies);
      close();
      router.refresh();
    } catch {
      setFailure("network");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setImported(null);
          setBinder(defaultBinder ?? "");
          dialog.current?.showModal();
        }}
      >
        <ClipboardPaste aria-hidden />
        {t("open")}
      </Button>
      <Toast
        message={
          imported === null ? null : { title: t("done", { count: imported }) }
        }
        onClose={hideImported}
        closeLabel={tDeck("close")}
      />

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
              aria-label={tDeck("close")}
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
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">
                  {fileName ?? t("fileLabel")}
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".txt,.csv,.dec,text/plain,text/csv"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={t("chooseFile")}
                  onChange={(event) => {
                    readFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload aria-hidden />
                  {t("chooseFile")}
                </Button>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={textId} className="font-medium text-sm">
                  {t("label")}
                </label>
                <textarea
                  id={textId}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setFileName(null);
                  }}
                  maxLength={MAX_COLLECTION_IMPORT_LENGTH}
                  rows={10}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <p className="text-muted-foreground text-sm">
                  {t("help", { max: MAX_COLLECTION_IMPORT_LINES })}
                </p>
              </div>

              {failure && (
                <p role="alert" className="text-destructive text-sm">
                  {t(`errors.${failure}`)}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  {tDeck("cancel")}
                </Button>
                <Button type="submit" disabled={loading || !text.trim()}>
                  {loading && (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  )}
                  {tDeck("analyze")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="rounded-md border border-l-4 border-l-primary px-3 py-2 text-sm">
                {t("recognized", {
                  copies: report.copies,
                  cards: report.entries.length,
                })}
              </p>

              {analysis.parsed.truncated && (
                <p role="alert" className="text-sm">
                  {t("truncated", { max: MAX_COLLECTION_IMPORT_LINES })}
                </p>
              )}

              {(report.unknown.length > 0 ||
                analysis.parsed.invalid.length > 0) && (
                <section className="space-y-2">
                  <h3 className="font-medium">
                    {tDeck("unknownTitle", {
                      count:
                        report.unknown.length + analysis.parsed.invalid.length,
                    })}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {tDeck("unknownHelp")}
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
                          {tDeck("invalidLine")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {binders.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor={binderId} className="font-medium text-sm">
                    {t("binderLabel")}
                  </label>
                  <select
                    id={binderId}
                    value={binder}
                    onChange={(event) => setBinder(event.target.value)}
                    className="block h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                  >
                    <option value="">{t("binderNone")}</option>
                    {binders.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {failure && (
                <p role="alert" className="text-destructive text-sm">
                  {t(`errors.${failure}`)}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setAnalysis(null)}>
                  {tDeck("back")}
                </Button>
                <Button
                  onClick={confirm}
                  disabled={loading || report.copies === 0}
                >
                  {loading && (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  )}
                  {t("confirm", { count: report.copies })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
