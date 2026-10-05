"use client";

import { CircleAlert, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { CardImage } from "@/components/cards/card-image";
import { ManaText, OracleText } from "@/components/cards/mana-text";
import { Button } from "@/components/ui/button";
import { maxCopies } from "@/domain/commander/singleton";
import type { DeckIssueCode } from "@/domain/commander/validate";
import type { DeckCard } from "@/domain/deck/deck";
import { MAX_QUANTITY } from "@/domain/deck/editor";
import { CardOptions, type Dispatch, QuantityStepper } from "./deck-list";

/**
 * Fenêtre d'une carte du deck (vues Piles et Grille) : image, texte,
 * quantité, déplacement, catégories et retrait. Elle se ferme d'elle-même
 * quand la carte quitte le deck.
 */
export function CardDialog({
  entry,
  cardIssues,
  datalistId,
  dispatch,
  onClose,
}: {
  entry: DeckCard | null;
  cardIssues: Record<string, DeckIssueCode[]>;
  datalistId: string;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const t = useTranslations("DeckEditor");
  const tIssues = useTranslations("DeckValidation.short");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isOpen = entry !== null;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen && !element.open) element.showModal();
    if (!isOpen && element.open) element.close();
  }, [isOpen]);

  const issues =
    entry && entry.zone !== "maybe" ? (cardIssues[entry.oracleId] ?? []) : [];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Échap est géré nativement par <dialog>
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sur le fond (hors du contenu) ferme la fenêtre.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      {entry && (
        <div className="grid max-h-[85vh] gap-5 overflow-y-auto p-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="mx-auto w-56 sm:w-full">
            <CardImage
              imageUris={entry.card.imageUris}
              name={entry.card.name}
              sizes="224px"
              priority
            />
          </div>
          <div className="min-w-0 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 id={titleId} className="font-semibold text-lg">
                  {entry.card.name}
                </h2>
                <p className="text-muted-foreground text-xs">
                  {entry.card.typeLine}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {entry.card.manaCost && <ManaText text={entry.card.manaCost} />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => dialog.current?.close()}
                  aria-label={t("closeCard")}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>
            {entry.card.oracleText && (
              <OracleText
                text={entry.card.oracleText}
                className="space-y-1 text-xs"
              />
            )}
            {issues.length > 0 && (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {issues.map((code) => tIssues(code)).join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {entry.zone !== "commander" && (
                <QuantityStepper
                  name={entry.card.name}
                  quantity={entry.quantity}
                  limit={Math.min(maxCopies(entry.card), MAX_QUANTITY)}
                  onChange={(quantity) =>
                    dispatch({
                      type: "setQuantity",
                      oracleId: entry.oracleId,
                      zone: entry.zone,
                      quantity,
                    })
                  }
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() =>
                  dispatch({
                    type: "remove",
                    oracleId: entry.oracleId,
                    zone: entry.zone,
                  })
                }
              >
                <Trash2 aria-hidden />
                {t("remove", { name: entry.card.name })}
              </Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <CardOptions
                key={`${entry.zone}|${entry.oracleId}`}
                entry={entry}
                datalistId={datalistId}
                dispatch={dispatch}
              />
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
