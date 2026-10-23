"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ExportDialog,
  fileSlug,
} from "@/components/import-export/export-dialog";
import type { DeckCard } from "@/domain/deck/deck";
import {
  DECK_EXPORT_FORMATS,
  type DeckExportFormat,
  exportDeck,
} from "@/domain/import-export/export";

/** Export du deck en liste texte, dans le format d'un autre outil. */
export function DeckExport({
  name,
  cards,
}: {
  name: string;
  cards: readonly DeckCard[];
}) {
  const t = useTranslations("DeckExport");
  const [format, setFormat] = useState<DeckExportFormat>("arena");
  const [includeMaybe, setIncludeMaybe] = useState(false);
  const [skipBasicLands, setSkipBasicLands] = useState(true);
  const hasMaybe = cards.some((entry) => entry.zone === "maybe");

  return (
    <ExportDialog
      title={t("title")}
      formats={DECK_EXPORT_FORMATS}
      format={format}
      onFormatChange={setFormat}
      formatLabel={(option) => t(`formats.${option}`)}
      formatHint={(option) => t(`hints.${option}`)}
      options={
        <>
          {hasMaybe && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeMaybe}
                onChange={(event) => setIncludeMaybe(event.target.checked)}
              />
              {t("includeMaybe")}
            </label>
          )}
          {format === "cardmarket" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skipBasicLands}
                onChange={(event) => setSkipBasicLands(event.target.checked)}
              />
              {t("skipBasicLands")}
            </label>
          )}
        </>
      }
      text={exportDeck(cards, format, { includeMaybe, skipBasicLands })}
      fileName={`${fileSlug(name)}${format === "plain" ? "" : `-${format}`}.txt`}
    />
  );
}
