"use client";

import { Check, Copy, Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Fenêtre d'export : choix du format, options, texte à copier ou à
 * télécharger. Le texte est calculé à l'ouverture et à chaque changement,
 * sans appel au serveur.
 */
export function ExportDialog<F extends string>({
  title,
  formats,
  format,
  onFormatChange,
  formatLabel,
  formatHint,
  options,
  text,
  fileName,
}: {
  title: string;
  formats: readonly F[];
  format: F;
  onFormatChange: (format: F) => void;
  formatLabel: (format: F) => string;
  formatHint?: (format: F) => string;
  /** Cases à cocher propres à ce qui est exporté. */
  options?: ReactNode;
  text: string;
  /** Nom du fichier téléchargé, extension comprise. */
  fileName: string;
}) {
  const t = useTranslations("ExportDialog");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable à la main.
    }
  }

  function changeFormat(next: F) {
    onFormatChange(next);
    setCopied(false);
  }

  function download() {
    const type = fileName.endsWith(".csv") ? "text/csv" : "text/plain";
    const url = URL.createObjectURL(
      new Blob([text], { type: `${type};charset=utf-8` }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setCopied(false);
          dialog.current?.showModal();
        }}
      >
        <Share aria-hidden />
        {t("open")}
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-semibold text-lg">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dialog.current?.close()}
              aria-label={t("close")}
              className="-mt-1 -mr-2"
            >
              <X aria-hidden />
            </Button>
          </div>

          <div className="space-y-1.5">
            {/* Sur téléphone, une liste déroulante ; sinon des boutons. */}
            <label
              htmlFor={`${titleId}-select`}
              className="block font-medium text-sm md:hidden"
            >
              {t("format")}
            </label>
            <select
              id={`${titleId}-select`}
              value={format}
              onChange={(event) => changeFormat(event.target.value as F)}
              className="block h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
            >
              {formats.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
            <fieldset className="hidden md:block">
              <legend className="mb-1.5 font-medium text-sm">
                {t("format")}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {formats.map((option) => (
                  <label
                    key={option}
                    className="relative cursor-pointer select-none rounded-md border px-3 py-1 font-medium text-sm transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name={`${titleId}-format`}
                      value={option}
                      checked={format === option}
                      onChange={() => changeFormat(option)}
                      className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                    />
                    {formatLabel(option)}
                  </label>
                ))}
              </div>
            </fieldset>
            {formatHint && (
              <p className="text-muted-foreground text-xs">
                {formatHint(format)}
              </p>
            )}
          </div>

          {options && <div className="space-y-1.5 text-sm">{options}</div>}

          <textarea
            readOnly
            value={text}
            aria-label={t("result")}
            rows={12}
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full whitespace-pre rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              role="status"
              className={cn(
                "mr-auto text-primary text-sm",
                !copied && "sr-only",
              )}
            >
              {copied ? t("copied") : ""}
            </span>
            <Button variant="outline" onClick={download} disabled={!text}>
              <Download aria-hidden />
              {t("download")}
            </Button>
            <Button onClick={copy} disabled={!text}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {t("copy")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Nom de fichier lisible tiré d'un titre (« Atraxa superfriends » → « atraxa-superfriends »). */
export function fileSlug(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "deck";
}
