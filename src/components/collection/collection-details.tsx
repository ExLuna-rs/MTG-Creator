"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { CardImage } from "@/components/cards/card-image";
import { GameChangerBadge } from "@/components/cards/game-changer-badge";
import { DeckStatusBadge } from "@/components/decks/deck-status";
import { cardHref } from "@/domain/cards/links";
import type { BinderSplit } from "@/domain/collection/binders";
import type { CollectionEntry } from "@/domain/collection/collection";
import type { CardUsage, DeckStatus } from "@/domain/collection/ownership";
import { Link, useRouter } from "@/i18n/navigation";
import { type BinderInfo, BinderStorage } from "./binder-storage";
import { UsageGauge } from "./usage-gauge";

export interface DeckInfo {
  name: string;
  status: DeckStatus;
}

/**
 * Cartes trouvées par la recherche, avec les decks où leurs exemplaires sont
 * rangés et ceux qui les contiennent sans exemplaire physique. Un exemplaire
 * peut être pris parmi les libres ou dans un autre deck.
 */
export function CollectionDetails({
  entries,
  usage,
  decks,
  binders,
  splits,
  from,
}: {
  entries: CollectionEntry[];
  usage: Record<string, CardUsage>;
  decks: Record<string, DeckInfo>;
  binders: readonly BinderInfo[];
  /** Exemplaires de chaque carte par classeur. */
  splits: Record<string, BinderSplit>;
  /** Recherche en cours, où la fiche d'une carte ramènera. */
  from: string;
}) {
  const t = useTranslations("CollectionPage");
  const tAssembly = useTranslations("DeckAssembly");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || requesting;

  async function take(
    deckId: string,
    oracleId: string,
    fromDeckId: string | null,
  ) {
    setError(null);
    setRequesting(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/copies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracleId, fromDeckId }),
      });
      if (!response.ok) throw new Error(String(response.status));
      startTransition(() => router.refresh());
    } catch {
      setError(tAssembly("error"));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <ul className="space-y-3" data-testid="collection-details">
        {entries.map((card) => {
          const cardUsage = usage[card.oracleId];
          if (!cardUsage) return null;
          return (
            <li
              key={card.oracleId}
              data-card={card.name}
              className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[6rem_minmax(0,1fr)]"
            >
              <Link
                href={cardHref(card.oracleId, from)}
                className="relative block self-start rounded-[4.75%/3.5%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CardImage
                  imageUris={card.imageUris}
                  name={card.name}
                  sizes="96px"
                />
                {card.gameChanger && <GameChangerBadge />}
              </Link>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={cardHref(card.oracleId, from)}
                    className="font-semibold hover:underline"
                  >
                    {card.name}
                  </Link>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {t("quantity", { count: card.quantity })}
                  </span>
                </div>
                <UsageGauge owned={card.quantity} usage={cardUsage} />
                <BinderStorage
                  card={card}
                  owned={card.quantity}
                  split={splits[card.oracleId] ?? {}}
                  binders={binders}
                />
                <DeckGroup title={t("usedIn")} empty={t("noUsedIn")}>
                  {cardUsage.usedIn.map(({ deckId, copies }) => (
                    <DeckLink
                      key={deckId}
                      deckId={deckId}
                      deck={decks[deckId]}
                      count={copies}
                    />
                  ))}
                </DeckGroup>
                <DeckGroup title={t("wantedBy")} empty={t("noWantedBy")}>
                  {cardUsage.wantedBy.map(({ deckId, missing }) => (
                    <div
                      key={deckId}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <DeckLink
                        deckId={deckId}
                        deck={decks[deckId]}
                        count={missing}
                      />
                      {cardUsage.free > 0 && (
                        <TakeButton
                          disabled={busy}
                          onClick={() => take(deckId, card.oracleId, null)}
                        >
                          {tAssembly("takeFree")}
                        </TakeButton>
                      )}
                      {cardUsage.usedIn
                        .filter((holder) => holder.deckId !== deckId)
                        .map((holder) => (
                          <TakeButton
                            key={holder.deckId}
                            disabled={busy}
                            onClick={() =>
                              take(deckId, card.oracleId, holder.deckId)
                            }
                          >
                            {tAssembly("takeFrom", {
                              deck: decks[holder.deckId]?.name ?? "",
                            })}
                          </TakeButton>
                        ))}
                    </div>
                  ))}
                </DeckGroup>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DeckGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </p>
      {children.length > 0 ? (
        <div className="flex flex-wrap gap-2">{children}</div>
      ) : (
        <p className="text-muted-foreground text-sm italic">{empty}</p>
      )}
    </div>
  );
}

function DeckLink({
  deckId,
  deck,
  count,
}: {
  deckId: string;
  deck: DeckInfo | undefined;
  count: number;
}) {
  if (!deck) return null;
  return (
    <Link
      href={`/decks/${deckId}/edit`}
      className="inline-flex items-center gap-2 rounded-lg border bg-background py-1 pr-2 pl-2.5 text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {deck.name}
      <DeckStatusBadge status={deck.status} />
      <span className="font-mono text-muted-foreground text-xs">×{count}</span>
    </Link>
  );
}

function TakeButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-dashed px-2 py-0.5 text-primary text-xs outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
