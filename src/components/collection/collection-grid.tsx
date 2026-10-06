"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CardImage } from "@/components/cards/card-image";
import { Button } from "@/components/ui/button";
import type { CollectionEntry } from "@/domain/collection/collection";
import { Link } from "@/i18n/navigation";
import { useCollectionChange } from "./use-collection-change";

/** Cartes de la collection, avec leur nombre d'exemplaires. */
export function CollectionGrid({ entries }: { entries: CollectionEntry[] }) {
  const t = useTranslations("CollectionPage");
  const { change, pending, error } = useCollectionChange();

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <ul
        data-testid="collection-grid"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {entries.map((card) => (
          <li key={card.oracleId} data-card={card.name} className="space-y-2">
            <Link
              href={`/cards/${card.oracleId}`}
              className="relative block rounded-[4.75%/3.5%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <CardImage
                imageUris={card.imageUris}
                name={card.name}
                sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 45vw"
              />
              {card.quantity > 1 && (
                <span
                  aria-hidden
                  className="absolute top-2 right-2 rounded-full bg-background/90 px-2 py-0.5 font-semibold text-sm tabular-nums shadow"
                >
                  ×{card.quantity}
                </span>
              )}
            </Link>
            <div className="flex items-center justify-between gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={t("decrease", { name: card.name })}
                disabled={pending}
                onClick={() => change(card.oracleId, -1)}
              >
                <Minus aria-hidden />
              </Button>
              <span
                className="text-center text-muted-foreground text-sm tabular-nums"
                data-testid="quantity"
              >
                {t("quantity", { count: card.quantity })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={t("increase", { name: card.name })}
                disabled={pending}
                onClick={() => change(card.oracleId, 1)}
              >
                <Plus aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
