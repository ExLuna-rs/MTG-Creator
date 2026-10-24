"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CardImage } from "@/components/cards/card-image";
import { GameChangerBadge } from "@/components/cards/game-changer-badge";
import { Button } from "@/components/ui/button";
import {
  type BinderSplit,
  type BinderView,
  copiesInView,
  unsortedCopies,
} from "@/domain/collection/binders";
import type { CollectionEntry } from "@/domain/collection/collection";
import type { CardUsage } from "@/domain/collection/ownership";
import { Link } from "@/i18n/navigation";
import type { BinderInfo } from "./binder-storage";
import { UsageGauge } from "./usage-gauge";
import { useCollectionChange } from "./use-collection-change";

/**
 * Cartes de la collection, avec leur nombre d'exemplaires et où ils sont.
 * Un clic sur une carte affiche le détail de ses exemplaires. Dans un
 * classeur, la pastille compte les exemplaires de ce classeur.
 */
export function CollectionGrid({
  entries,
  usage,
  binders,
  splits,
  view,
  keep,
}: {
  entries: CollectionEntry[];
  usage: Record<string, CardUsage>;
  binders: readonly BinderInfo[];
  splits: Record<string, BinderSplit>;
  view: BinderView;
  /** Paramètres gardés en ouvrant le détail d'une carte (classeur). */
  keep: Record<string, string>;
}) {
  const t = useTranslations("CollectionPage");
  const tBinders = useTranslations("Binders");
  const { change, pending, error } = useCollectionChange();

  // « 2 Classeur rouge · 1 non rangé » : où sont les exemplaires d'une carte.
  function where(card: CollectionEntry): string {
    const split = splits[card.oracleId] ?? {};
    const unsorted = unsortedCopies(card.quantity, split);
    return [
      ...binders
        .filter((binder) => split[binder.id])
        .map((binder) =>
          tBinders("whereBinder", {
            count: split[binder.id],
            name: binder.name,
          }),
        ),
      ...(unsorted > 0 ? [tBinders("whereUnsorted", { count: unsorted })] : []),
    ].join(" · ");
  }

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
        {entries.map((card) => {
          const shown = copiesInView(
            card.quantity,
            splits[card.oracleId] ?? {},
            view,
          );
          return (
            <li key={card.oracleId} data-card={card.name} className="space-y-2">
              <Link
                href={{
                  pathname: "/collection",
                  query: { ...keep, q: card.name },
                }}
                scroll={false}
                aria-label={t("showWhere", { name: card.name })}
                className="relative block rounded-[4.75%/3.5%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CardImage
                  imageUris={card.imageUris}
                  name={card.name}
                  sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 45vw"
                />
                {card.gameChanger && <GameChangerBadge />}
                {shown > 1 && (
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 rounded-full bg-background/90 px-2 py-0.5 font-semibold text-sm tabular-nums shadow"
                  >
                    ×{shown}
                  </span>
                )}
              </Link>
              {binders.length > 0 && (
                <p
                  className="line-clamp-2 text-muted-foreground text-xs"
                  title={where(card)}
                  data-testid="binder-where"
                >
                  {where(card)}
                </p>
              )}
              {usage[card.oracleId] && (
                <UsageGauge
                  owned={card.quantity}
                  usage={usage[card.oracleId]}
                />
              )}
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
          );
        })}
      </ul>
    </div>
  );
}
