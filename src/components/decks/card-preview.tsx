import { CardImage } from "@/components/cards/card-image";
import { ManaText, OracleText } from "@/components/cards/mana-text";
import type { DeckCardData } from "@/domain/deck/deck";

/** Aperçu de la carte survolée : image, coût, type et texte Oracle. */
export function CardPreview({ card }: { card: DeckCardData }) {
  return (
    <div data-testid="card-preview" className="space-y-2 text-sm">
      <div className="mx-auto w-56">
        <CardImage imageUris={card.imageUris} name={card.name} sizes="224px" />
      </div>
      <div className="space-y-1">
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
          <OracleText text={card.oracleText} className="space-y-1 text-xs" />
        )}
      </div>
    </div>
  );
}
