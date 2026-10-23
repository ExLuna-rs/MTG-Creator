"use client";

import { CircleCheck, PackageOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deckStatus,
  missingCopies,
  type Quantities,
} from "@/domain/collection/ownership";
import type { DeckCardData } from "@/domain/deck/deck";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DeckStatusBadge } from "./deck-status";

/** Exemplaires physiques vus depuis le deck ouvert (voir getDeckOwnership). */
export interface DeckOwnershipData {
  assembled: boolean;
  owned: Quantities;
  holdings: { deckId: string; name: string; copies: Quantities }[];
}

/** Où sont les exemplaires d'une carte, vus depuis le deck ouvert. */
export interface CopyInfo {
  need: number;
  copies: number;
  free: number;
  owned: number;
  /** Autres decks qui ont un exemplaire de la carte. */
  heldBy: { deckId: string; name: string; copies: number }[];
}

interface OwnershipContextValue {
  copyInfo: (oracleId: string) => CopyInfo;
  take: (oracleId: string, fromDeckId: string | null) => void;
  /** Actions impossibles pendant une sauvegarde ou une requête en cours. */
  busy: boolean;
}

const OwnershipContext = createContext<OwnershipContextValue | null>(null);

/** Nombre de cartes manquantes affichées avant « Voir les autres ». */
const MISSING_PREVIEW = 8;

/**
 * Données et actions sur les exemplaires physiques du deck ouvert, partagées
 * par l'en-tête de l'éditeur et la fenêtre d'une carte.
 */
export function useDeckOwnership({
  deckId,
  ownership,
  needs,
  saved,
}: {
  deckId: string;
  ownership: DeckOwnershipData;
  /** Besoins du deck tel qu'il est dans l'éditeur. */
  needs: Quantities;
  /** Toutes les modifications du deck sont enregistrées. */
  saved: boolean;
}) {
  const t = useTranslations("DeckAssembly");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      ownership.holdings.find((holding) => holding.deckId === deckId)?.copies ??
      {},
    [ownership, deckId],
  );
  const status = deckStatus(ownership.assembled, needs, mine);
  const missing = ownership.assembled ? missingCopies(needs, mine) : [];
  const busy = pending || requesting || !saved;

  function copyInfo(oracleId: string): CopyInfo {
    const owned = ownership.owned[oracleId] ?? 0;
    const used = ownership.holdings.reduce(
      (total, holding) => total + (holding.copies[oracleId] ?? 0),
      0,
    );
    return {
      need: needs[oracleId] ?? 0,
      copies: Math.min(mine[oracleId] ?? 0, needs[oracleId] ?? 0),
      free: Math.max(0, owned - used),
      owned,
      heldBy: ownership.holdings
        .filter((holding) => holding.deckId !== deckId)
        .flatMap((holding) => {
          const copies = holding.copies[oracleId] ?? 0;
          return copies > 0
            ? [{ deckId: holding.deckId, name: holding.name, copies }]
            : [];
        }),
    };
  }

  async function send(url: string, method: string, body: unknown) {
    setError(null);
    setRequesting(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(String(response.status));
      startTransition(() => router.refresh());
    } catch {
      setError(t("error"));
    } finally {
      setRequesting(false);
    }
  }

  return {
    status,
    missing,
    error,
    busy,
    assembled: ownership.assembled,
    setAssembled: (assembled: boolean) =>
      send(`/api/decks/${deckId}/assembly`, "PUT", { assembled }),
    context: {
      copyInfo,
      busy,
      take: (oracleId: string, fromDeckId: string | null) =>
        send(`/api/decks/${deckId}/copies`, "POST", { oracleId, fromDeckId }),
    } satisfies OwnershipContextValue,
  };
}

export type DeckOwnershipState = ReturnType<typeof useDeckOwnership>;

export function OwnershipProvider({
  value,
  children,
}: {
  value: OwnershipContextValue;
  children: ReactNode;
}) {
  return <OwnershipContext value={value}>{children}</OwnershipContext>;
}

/** Sélecteur En construction / Monté et statut du deck, pour l'en-tête. */
export function DeckAssemblyToggle({ state }: { state: DeckOwnershipState }) {
  const t = useTranslations("DeckAssembly");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DeckStatusBadge status={state.status} />
      <fieldset className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        <legend className="sr-only">{t("legend")}</legend>
        {([false, true] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={state.assembled === value}
            disabled={state.busy}
            onClick={() => {
              if (state.assembled !== value) state.setAssembled(value);
            }}
            className="rounded-md px-2.5 py-1 disabled:opacity-60 aria-pressed:bg-background aria-pressed:shadow-xs"
          >
            {value ? t("assembled") : t("building")}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * Cartes qui manquent physiquement au deck monté, avec d'où les prendre :
 * un exemplaire libre de la collection ou celui d'un autre deck.
 */
export function DeckAssemblyNotice({
  state,
  cards,
}: {
  state: DeckOwnershipState;
  cards: Record<string, DeckCardData>;
}) {
  const t = useTranslations("DeckAssembly");
  const [expanded, setExpanded] = useState(false);

  if (!state.assembled) {
    return (
      <Notice>
        <p className="flex items-start gap-2 text-muted-foreground">
          <PackageOpen className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("buildingHint")}
        </p>
        {state.error && <ErrorText>{state.error}</ErrorText>}
      </Notice>
    );
  }
  if (state.missing.length === 0) {
    return (
      <Notice className="border-emerald-500/40 bg-emerald-500/10">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck
            className="size-4 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          {t("playable")}
        </p>
        {state.error && <ErrorText>{state.error}</ErrorText>}
      </Notice>
    );
  }

  const missing = state.missing
    .flatMap((item) => {
      const card = cards[item.oracleId];
      return card ? [{ ...item, card }] : [];
    })
    .sort((a, b) => a.card.name.localeCompare(b.card.name, "en"));
  const shown = expanded ? missing : missing.slice(0, MISSING_PREVIEW);

  return (
    <Notice className="border-destructive/40 bg-destructive/5">
      <p className="font-medium">
        {t("missingTitle", { count: missing.length })}
      </p>
      {state.error && <ErrorText>{state.error}</ErrorText>}
      <ul className="space-y-1.5" data-testid="missing-copies">
        {shown.map(({ oracleId, missing: count, card }) => (
          <li key={oracleId} className="flex flex-wrap items-center gap-2">
            <span>
              {card.name}
              {count > 1 && <span className="tabular-nums"> ×{count}</span>}
            </span>
            <CopySources oracleId={oracleId} context={state.context} />
          </li>
        ))}
      </ul>
      {missing.length > shown.length && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          {t("showAll", { count: missing.length - shown.length })}
        </button>
      )}
    </Notice>
  );
}

/** Boutons pour ranger dans le deck un exemplaire d'une carte. */
function CopySources({
  oracleId,
  context,
}: {
  oracleId: string;
  context: OwnershipContextValue;
}) {
  const t = useTranslations("DeckAssembly");
  const info = context.copyInfo(oracleId);
  if (info.free === 0 && info.heldBy.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">{t("notOwned")}</span>
    );
  }
  return (
    <>
      {info.free > 0 && (
        <SourceButton
          disabled={context.busy}
          onClick={() => context.take(oracleId, null)}
        >
          {t("takeFree")}
        </SourceButton>
      )}
      {info.heldBy.map((holder) => (
        <SourceButton
          key={holder.deckId}
          disabled={context.busy}
          onClick={() => context.take(oracleId, holder.deckId)}
        >
          {t("takeFrom", { deck: holder.name })}
        </SourceButton>
      ))}
    </>
  );
}

function SourceButton({
  children,
  ...props
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-dashed px-2 py-0.5 text-primary text-xs outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Exemplaire physique d'une carte, dans la fenêtre de la carte. */
export function CardCopies({ oracleId }: { oracleId: string }) {
  const t = useTranslations("DeckAssembly");
  const context = useContext(OwnershipContext);
  if (!context) return null;
  const info = context.copyInfo(oracleId);
  if (info.need === 0) return null;
  return (
    <div className="space-y-1.5" data-testid="card-copies">
      <p className="font-medium">{t("copiesTitle")}</p>
      <p className="text-muted-foreground text-xs">
        {t("inThisDeck", { copies: info.copies, need: info.need })}
        {" · "}
        {t("freeCopies", { count: info.free })}
        {info.heldBy.map((holder) => (
          <span key={holder.deckId}>
            {" · "}
            {t("heldBy", { count: holder.copies, deck: holder.name })}
          </span>
        ))}
      </p>
      {info.copies < info.need && (
        <div className="flex flex-wrap gap-2">
          <CopySources oracleId={oracleId} context={context} />
        </div>
      )}
    </div>
  );
}

function Notice({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("space-y-2 rounded-xl border px-4 py-3 text-sm", className)}
    >
      {children}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive">
      {children}
    </p>
  );
}
