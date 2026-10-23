import { useTranslations } from "next-intl";
import type { CardUsage } from "@/domain/collection/ownership";
import { cn } from "@/lib/utils";

/** Au-delà, la jauge ne dessine plus un segment par exemplaire. */
const MAX_SEGMENTS = 12;

/**
 * Jauge des exemplaires d'une carte : rangés dans un deck, libres, et
 * manquants aux decks montés.
 */
export function UsageGauge({
  owned,
  usage,
  className,
}: {
  owned: number;
  usage: CardUsage;
  className?: string;
}) {
  const t = useTranslations("CollectionPage");
  const used = Math.min(usage.used, owned);
  const segments = [
    ...Array<string>(used).fill("used"),
    ...Array<string>(usage.free).fill("free"),
    ...Array<string>(usage.missing).fill("missing"),
  ];
  const total = segments.length;
  // Beaucoup d'exemplaires : des proportions plutôt qu'un segment chacun.
  const bars =
    total > MAX_SEGMENTS
      ? [
          { kind: "used", grow: used },
          { kind: "free", grow: usage.free },
          { kind: "missing", grow: usage.missing },
        ].filter((bar) => bar.grow > 0)
      : segments.map((kind) => ({ kind, grow: 1 }));

  return (
    <div className={cn("space-y-1", className)} data-testid="usage">
      <div className="flex h-1.5 gap-0.5" aria-hidden>
        {bars.map((bar, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: segments identiques et sans état
            key={index}
            style={{ flexGrow: bar.grow }}
            className={cn(
              "basis-0 rounded-full",
              bar.kind === "used" && "bg-emerald-500",
              bar.kind === "free" && "bg-border",
              bar.kind === "missing" &&
                "border border-destructive bg-[repeating-linear-gradient(45deg,var(--color-destructive)_0_2px,transparent_2px_4px)]",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        {usage.used > 0 && (
          <>
            <span className="font-medium text-foreground">
              {t("usageUsed", { count: usage.used })}
            </span>
            {" · "}
          </>
        )}
        {t("usageFree", { count: usage.free })}
        {usage.missing > 0 && (
          <span className="font-medium text-destructive">
            {" · "}
            {t("usageMissing", { count: usage.missing })}
          </span>
        )}
      </p>
    </div>
  );
}
