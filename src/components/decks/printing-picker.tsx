"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { printingPrice } from "@/domain/cards/printing";
import type { DeckCard, DeckPrinting } from "@/domain/deck/deck";
import { cn } from "@/lib/utils";
import type { Dispatch } from "./deck-list";

/** Versions montrées avant « Voir les autres versions ». */
const SHOWN_PRINTINGS = 24;

type Loaded =
  | { oracleId: string; printings: DeckPrinting[] }
  | { oracleId: string; failed: true };

/**
 * Bande « Version dans ce deck » de la fenêtre d'une carte : l'édition par
 * défaut ou une édition précise. L'image, le prix du deck et l'export
 * suivent la version choisie.
 */
export function PrintingPicker({
  entry,
  dispatch,
}: {
  entry: DeckCard;
  dispatch: Dispatch;
}) {
  const t = useTranslations("DeckEditor");
  const format = useFormatter();
  const currency = useLocale() === "en" ? "USD" : "EUR";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { oracleId } = entry;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cards/printings?${new URLSearchParams({ card: oracleId })}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ printings: DeckPrinting[] }>;
      })
      .then(({ printings }) => setLoaded({ oracleId, printings }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ oracleId, failed: true });
      });
    return () => controller.abort();
  }, [oracleId]);

  const current = loaded?.oracleId === oracleId ? loaded : null;
  const selectedId = entry.printing?.id ?? null;

  function choose(printing: DeckPrinting | null) {
    dispatch({
      type: "setPrinting",
      oracleId: entry.oracleId,
      zone: entry.zone,
      printing,
    });
  }

  const price = (value: number | null) =>
    value === null
      ? t("printingNoPrice")
      : format.number(value, { style: "currency", currency });

  let content: React.ReactNode;
  if (!current) {
    content = (
      <p className="text-muted-foreground text-xs">{t("printingLoading")}</p>
    );
  } else if ("failed" in current) {
    content = <p className="text-destructive text-xs">{t("printingError")}</p>;
  } else if (current.printings.length <= 1) {
    content = (
      <p className="text-muted-foreground text-xs">{t("printingSingle")}</p>
    );
  } else {
    const { printings } = current;
    // La version choisie reste visible même au-delà des premières.
    const shown = showAll
      ? printings
      : printings.filter(
          (printing, index) =>
            index < SHOWN_PRINTINGS || printing.id === selectedId,
        );
    content = (
      <>
        <ul className="flex gap-2 overflow-x-auto pb-1.5">
          <li className="w-[4.75rem] flex-none">
            <button
              type="button"
              aria-pressed={selectedId === null}
              onClick={() => choose(null)}
              className={tileClass}
            >
              <span className="grid aspect-[488/680] w-full place-items-center rounded-[4.75%/3.5%] border-2 border-dashed text-[11px] text-muted-foreground">
                {t("printingDefaultShort")}
              </span>
              <span className="font-medium text-[11px]">
                {t("printingDefault")}
              </span>
            </button>
          </li>
          {shown.map((printing) => (
            <li key={printing.id} className="w-[4.75rem] flex-none">
              <button
                type="button"
                aria-pressed={printing.id === selectedId}
                aria-label={t("printingLabel", {
                  set: printing.setName,
                  number: printing.collectorNumber,
                })}
                title={`${printing.setName} · ${printing.collectorNumber}`}
                onClick={() => choose(printing)}
                className={tileClass}
              >
                <CardImage
                  imageUris={printing.imageUris}
                  name={printing.setName}
                  decorative
                  sizes="72px"
                />
                <span className="truncate font-medium font-mono text-[11px] uppercase">
                  {printing.setCode} {printing.collectorNumber}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {price(printingPrice(printing, currency))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!showAll && printings.length > shown.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-primary text-xs underline-offset-4 hover:underline"
          >
            {t("printingShowAll", { count: printings.length })}
          </button>
        )}
      </>
    );
  }

  return (
    <section
      className="min-w-0 space-y-2"
      aria-labelledby={`${oracleId}-printing`}
    >
      <h3 id={`${oracleId}-printing`} className="font-medium text-sm">
        {t("printingTitle")}
      </h3>
      {content}
      <p className="text-muted-foreground text-xs">
        {entry.printing
          ? t("printingChosen", {
              set: entry.printing.setName,
              number: entry.printing.collectorNumber,
              price: price(
                entry.card[currency === "EUR" ? "priceEur" : "priceUsd"],
              ),
            })
          : t("printingDefaultHint")}
      </p>
    </section>
  );
}

const tileClass = cn(
  "grid w-full gap-1 rounded-lg border-2 border-transparent p-0.5 text-center outline-none",
  "hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary",
);
