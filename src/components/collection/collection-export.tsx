"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ExportDialog } from "@/components/import-export/export-dialog";
import {
  COLLECTION_EXPORT_FORMATS,
  type CollectionExportEntry,
  type CollectionExportFormat,
  exportCollection,
} from "@/domain/import-export/export";

/** Export de la collection en texte ou en CSV. */
export function CollectionExport({
  entries,
}: {
  entries: readonly CollectionExportEntry[];
}) {
  const t = useTranslations("CollectionExport");
  const [format, setFormat] = useState<CollectionExportFormat>("text");
  return (
    <ExportDialog
      title={t("title")}
      formats={COLLECTION_EXPORT_FORMATS}
      format={format}
      onFormatChange={setFormat}
      formatLabel={(option) => t(`formats.${option}`)}
      formatHint={(option) => t(`hints.${option}`)}
      text={exportCollection(entries, format)}
      fileName={`collection.${format === "csv" ? "csv" : "txt"}`}
    />
  );
}
