"use client";

import { Minus, Plus, Sparkles } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { sendJson } from "@/components/organizer/folder-nav";
import { Button } from "@/components/ui/button";
import {
  type CollectionPrinting,
  copyPrice,
  hasFinish,
  type PrintingSplit,
  unspecifiedCopies,
} from "@/domain/collection/printings";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm";

/** « LEA · 269 » */
const editionCode = (printing: CollectionPrinting) =>
  `${printing.setCode.toUpperCase()} · ${printing.collectorNumber}`;

/**
 * Éditions des exemplaires d'une carte : combien de chaque édition et
 * finition, et combien sans édition précisée. Préciser une édition prend un
 * exemplaire parmi les non précisés ; le retirer l'y remet.
 */
export function PrintingStorage({
  card,
  owned,
  split,
}: {
  card: { oracleId: string; name: string };
  owned: number;
  split: PrintingSplit;
}) {
  const t = useTranslations("CollectionPrintings");
  const format = useFormatter();
  const currency = useLocale() === "en" ? "USD" : "EUR";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const busy = pending || requesting;
  const unspecified = unspecifiedCopies(owned, split);

  async function store(
    printingId: string,
    foil: boolean,
    quantity: number,
  ): Promise<boolean> {
    setFailed(false);
    setRequesting(true);
    const result = await sendJson("/api/collection/printings", "PUT", {
      oracleId: card.oracleId,
      printingId,
      foil,
      quantity,
    });
    setRequesting(false);
    if (!result.ok) {
      setFailed(true);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  const price = (printing: CollectionPrinting, foil: boolean) => {
    const value = copyPrice(printing, foil, currency);
    return value === null
      ? t("noPrice")
      : format.number(value, { style: "currency", currency });
  };

  return (
    <div className="space-y-1.5" data-testid="printing-storage">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {t("title")}
      </p>
      <ul className="divide-y rounded-lg border text-sm sm:max-w-md">
        {split.map(({ printing, foil, quantity }) => {
          const label = t("copiesLabel", {
            name: card.name,
            set: printing.setName,
            number: printing.collectorNumber,
            foil: String(foil),
          });
          return (
            <li
              key={`${printing.id}-${foil}`}
              className="flex items-center gap-3 py-1 pr-1 pl-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block">{printing.setName}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                  <span className="font-mono">{editionCode(printing)}</span>
                  {foil && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      <Sparkles className="size-3" aria-hidden />
                      {t("foil")}
                    </span>
                  )}
                  <span className="tabular-nums">{price(printing, foil)}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 sm:size-7"
                  disabled={busy}
                  aria-label={t("decrease", { label })}
                  onClick={() => store(printing.id, foil, quantity - 1)}
                >
                  <Minus aria-hidden />
                </Button>
                <span className="w-6 text-center tabular-nums">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 sm:size-7"
                  disabled={busy || unspecified === 0}
                  aria-label={t("increase", { label })}
                  onClick={() => store(printing.id, foil, quantity + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </span>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 py-1.5 pr-3 pl-3 text-muted-foreground">
          <span>{t("unspecified")}</span>
          <span className="tabular-nums">{unspecified}</span>
        </li>
      </ul>
      {unspecified > 0 &&
        (adding ? (
          <PrintingPicker
            card={card}
            busy={busy}
            onCancel={() => setAdding(false)}
            onPick={async (printingId, foil) => {
              const existing =
                split.find(
                  (copies) =>
                    copies.printingId === printingId && copies.foil === foil,
                )?.quantity ?? 0;
              if (await store(printingId, foil, existing + 1)) setAdding(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-primary text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden />
            {t("specify")}
          </button>
        ))}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </div>
  );
}

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; printings: CollectionPrinting[] };

/** Choix d'une édition (liste déroulante) et de la finition d'un exemplaire. */
function PrintingPicker({
  card,
  busy,
  onPick,
  onCancel,
}: {
  card: { oracleId: string; name: string };
  busy: boolean;
  onPick: (printingId: string, foil: boolean) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("CollectionPrintings");
  const id = useId();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [printingId, setPrintingId] = useState("");
  const [foil, setFoil] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/cards/printings?${new URLSearchParams({ card: card.oracleId })}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ printings: CollectionPrinting[] }>;
      })
      .then(({ printings }) => {
        setLoaded({ state: "ready", printings });
        setPrintingId(printings[0]?.id ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ state: "failed" });
      });
    return () => controller.abort();
  }, [card.oracleId]);

  if (loaded.state !== "ready") {
    return (
      <p
        className={cn(
          "text-sm",
          loaded.state === "failed"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {loaded.state === "failed" ? t("loadError") : t("loading")}
      </p>
    );
  }

  const printing = loaded.printings.find((item) => item.id === printingId);
  const canFoil = printing ? hasFinish(printing, true) : false;
  const canNormal = printing ? hasFinish(printing, false) : false;
  // Une édition qui n'existe qu'en brillant (ou qu'en normal) fixe la finition.
  const chosenFoil = canFoil && (foil || !canNormal);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (printing) onPick(printing.id, chosenFoil);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-lg border border-dashed p-3 sm:max-w-md"
      aria-label={t("specifyFor", { name: card.name })}
    >
      <label htmlFor={`${id}-printing`} className="block font-medium text-sm">
        {t("edition")}
      </label>
      <select
        id={`${id}-printing`}
        value={printingId}
        onChange={(event) => setPrintingId(event.target.value)}
        className={selectClassName}
      >
        {loaded.printings.map((item) => (
          <option key={item.id} value={item.id}>
            {item.setName} ({editionCode(item)})
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={chosenFoil}
          disabled={!canFoil || !canNormal}
          onChange={(event) => setFoil(event.target.checked)}
          className="size-4 accent-primary"
        />
        {t("foilLabel")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !printing}>
          {t("add")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
