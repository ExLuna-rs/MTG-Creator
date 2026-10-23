import { useTranslations } from "next-intl";
import type { DeckStatus } from "@/domain/collection/ownership";
import { cn } from "@/lib/utils";

const STYLES: Record<DeckStatus, string> = {
  building:
    "bg-amber-100 text-amber-800 before:border-[1.5px] before:border-current before:bg-transparent dark:bg-amber-950 dark:text-amber-300",
  built: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  playable:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Pastille du statut d'un deck : en construction, construit ou jouable. */
export function DeckStatusBadge({
  status,
  className,
}: {
  status: DeckStatus;
  className?: string;
}) {
  const t = useTranslations("DeckStatus");
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium text-xs before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        STYLES[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
