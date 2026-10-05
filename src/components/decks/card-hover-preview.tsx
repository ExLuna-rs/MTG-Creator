"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { ManaText, OracleText } from "@/components/cards/mana-text";
import type { DeckCardData } from "@/domain/deck/deck";

/** Carte survolée et position de sa ligne dans la fenêtre. */
export interface HoveredCard {
  card: DeckCardData;
  anchor: DOMRect;
}

const WIDTH = 256;
const GAP = 12;
const MARGIN = 8;

/**
 * Aperçu flottant d'une carte de la liste : image, coût, type et texte.
 * Placé à droite de la ligne survolée (à gauche s'il n'y a pas la place) et
 * gardé dans la fenêtre. Réservé aux grands écrans : sur mobile, les options
 * de la carte affichent son texte.
 */
export function CardHoverPreview({ hovered }: { hovered: HoveredCard }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const { card, anchor } = hovered;

  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    const right = anchor.right + GAP;
    const left =
      right + WIDTH + MARGIN <= window.innerWidth
        ? right
        : Math.max(MARGIN, anchor.left - GAP - WIDTH);
    const top = Math.max(
      MARGIN,
      Math.min(anchor.top, window.innerHeight - height - MARGIN),
    );
    setPosition({ left, top });
  }, [anchor]);

  return (
    <div
      ref={ref}
      data-testid="card-hover-preview"
      aria-hidden
      style={{
        width: WIDTH,
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      className="pointer-events-none fixed z-50 hidden space-y-2 rounded-lg border bg-card p-2 text-card-foreground text-sm shadow-lg lg:block"
    >
      <CardImage
        imageUris={card.imageUris}
        name={card.name}
        decorative
        sizes={`${WIDTH - 16}px`}
        priority
      />
      <div className="space-y-1 px-1 pb-1">
        <p className="flex items-start justify-between gap-2 font-medium">
          <span>{card.name}</span>
          {card.manaCost && (
            <span className="shrink-0 text-xs">
              <ManaText text={card.manaCost} />
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">{card.typeLine}</p>
        {card.oracleText && (
          <OracleText
            text={card.oracleText}
            className="max-h-40 space-y-1 overflow-hidden text-xs"
          />
        )}
      </div>
    </div>
  );
}
