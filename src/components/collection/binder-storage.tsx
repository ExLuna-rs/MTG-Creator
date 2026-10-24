"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { sendJson } from "@/components/organizer/folder-nav";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { type BinderSplit, unsortedCopies } from "@/domain/collection/binders";
import { useRouter } from "@/i18n/navigation";

export interface BinderInfo {
  id: string;
  name: string;
}

/**
 * Rangement des exemplaires d'une carte : combien dans chaque classeur, et
 * combien non rangés. Ranger un exemplaire le prend parmi les non rangés.
 */
export function BinderStorage({
  card,
  owned,
  split,
  binders,
}: {
  card: { oracleId: string; name: string };
  owned: number;
  split: BinderSplit;
  binders: readonly BinderInfo[];
}) {
  const t = useTranslations("Binders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = pending || requesting;
  const unsorted = unsortedCopies(owned, split);
  const holding = binders.filter((binder) => (split[binder.id] ?? 0) > 0);
  const others = binders.filter((binder) => !split[binder.id]);

  async function store(binderId: string, quantity: number) {
    setFailed(false);
    setRequesting(true);
    const result = await sendJson(`/api/binders/${binderId}/cards`, "PUT", {
      oracleId: card.oracleId,
      quantity,
    });
    setRequesting(false);
    if (!result.ok) return setFailed(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-1.5" data-testid="binder-storage">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {t("storage")}
      </p>
      {binders.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{t("noBinders")}</p>
      ) : (
        <>
          <ul className="max-w-sm divide-y rounded-lg border text-sm">
            {holding.map((binder) => {
              const copies = split[binder.id] ?? 0;
              return (
                <li
                  key={binder.id}
                  className="flex items-center justify-between gap-3 py-1 pr-1 pl-3"
                >
                  <span className="min-w-0 truncate">{binder.name}</span>
                  <span className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={busy}
                      aria-label={t("decrease", {
                        name: card.name,
                        binder: binder.name,
                      })}
                      onClick={() => store(binder.id, copies - 1)}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <span className="w-6 text-center tabular-nums">
                      {copies}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={busy || unsorted === 0}
                      aria-label={t("increase", {
                        name: card.name,
                        binder: binder.name,
                      })}
                      onClick={() => store(binder.id, copies + 1)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </span>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 py-1.5 pr-3 pl-3 text-muted-foreground">
              <span>{t("unsorted")}</span>
              <span className="tabular-nums">{unsorted}</span>
            </li>
          </ul>
          {unsorted > 0 && others.length > 0 && (
            <Menu
              label={t("putIn")}
              trigger={
                <>
                  <Plus className="size-4" aria-hidden />
                  {t("putIn")}
                </>
              }
              triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-primary text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
              className="inline-block"
              align="start"
              items={others.map((binder) => ({
                key: binder.id,
                label: binder.name,
                onSelect: () => store(binder.id, 1),
              }))}
            />
          )}
          {holding.length > 0 && (
            <p className="text-muted-foreground text-xs">{t("moveHint")}</p>
          )}
        </>
      )}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("errors.network")}
        </p>
      )}
    </div>
  );
}
