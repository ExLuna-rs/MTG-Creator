"use client";

import { Check, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { CardNameInput } from "@/components/cards/card-name-input";
import { Button } from "@/components/ui/button";
import type { ScanListItem } from "@/server/collection/scan";
import type { ScanList } from "./use-scan-list";

/**
 * Liste de scan modifiable : quantités, correction d'une carte mal reconnue,
 * retrait ; puis ajout de toute la liste à la collection.
 */
export function ScanListView({
  list,
  onCommitted,
}: {
  list: ScanList;
  onCommitted?: (added: number) => void;
}) {
  const t = useTranslations("ScanList");
  const [committed, setCommitted] = useState<number | null>(null);
  const total = list.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section aria-labelledby="scan-list-title" className="space-y-3">
      <div className="space-y-1">
        <h2 id="scan-list-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {list.items.length === 0 ? t("empty") : t("hint")}
        </p>
      </div>

      {list.items.length > 0 && (
        <ul className="divide-y rounded-md border">
          {list.items.map((item) => (
            <ScanListRow key={item.id} item={item} list={list} />
          ))}
        </ul>
      )}

      <div role="status" className="text-sm">
        {list.error ? (
          <p className="text-destructive">{t("error")}</p>
        ) : (
          committed !== null && (
            <p className="flex items-center gap-1.5 font-medium">
              <Check className="size-4 text-primary" aria-hidden />
              {t("committed", { count: committed })}
            </p>
          )
        )}
      </div>

      {list.items.length > 0 && (
        <Button
          className="w-full sm:w-auto"
          disabled={list.busy}
          onClick={async () => {
            const added = await list.commit();
            if (added !== null) {
              setCommitted(added);
              onCommitted?.(added);
            }
          }}
        >
          <Check aria-hidden />
          {t("commit", { count: total })}
        </Button>
      )}
    </section>
  );
}

function ScanListRow({ item, list }: { item: ScanListItem; list: ScanList }) {
  const t = useTranslations("ScanList");
  const fieldId = useId();
  const [fixing, setFixing] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <li data-card={item.name} className="space-y-2 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="w-9 shrink-0">
          <CardImage
            imageUris={item.imageUris}
            name={item.name}
            decorative
            sizes="36px"
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("decrease", { name: item.name })}
            disabled={list.busy}
            onClick={() =>
              list.update(item.id, { quantity: item.quantity - 1 })
            }
          >
            <Minus aria-hidden />
          </Button>
          <span className="w-6 text-center text-sm tabular-nums">
            <span aria-hidden>{item.quantity}</span>
            <span className="sr-only">
              {t("quantity", { name: item.name, count: item.quantity })}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("increase", { name: item.name })}
            disabled={list.busy}
            onClick={() =>
              list.update(item.id, { quantity: item.quantity + 1 })
            }
          >
            <Plus aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("fix", { name: item.name })}
            aria-expanded={fixing}
            onClick={() => setFixing((open) => !open)}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("remove", { name: item.name })}
            disabled={list.busy}
            onClick={() => list.remove(item.id)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      {fixing && (
        <div className="space-y-1">
          <label htmlFor={fieldId} className="text-muted-foreground text-xs">
            {t("fixLabel", { name: item.name })}
          </label>
          <CardNameInput
            id={fieldId}
            name="name"
            value={search}
            onValueChange={setSearch}
            placeholder={t("fixPlaceholder")}
            suggestionsLabel={t("fixPlaceholder")}
            onSelect={async (suggestion) => {
              setFixing(false);
              setSearch("");
              await list.update(item.id, { oracleId: suggestion.oracleId });
            }}
          />
        </div>
      )}
    </li>
  );
}
