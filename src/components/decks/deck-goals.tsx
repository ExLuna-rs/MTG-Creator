import { useTranslations } from "next-intl";
import type { CardRole, RoleGoal } from "@/domain/deck/roles";
import { cn } from "@/lib/utils";

/**
 * Objectifs du deck : pour chaque rôle (terrains, rampe, pioche…), nombre de
 * cartes comparé au nombre visé.
 */
export function DeckGoals({
  goals,
  counts,
}: {
  goals: readonly RoleGoal[];
  counts: Record<CardRole, number>;
}) {
  const t = useTranslations("DeckGoals");
  const tRoles = useTranslations("CardRoles");
  return (
    <section aria-labelledby="goals-title" className="space-y-3">
      <h2 id="goals-title" className="font-semibold">
        {t("title")}
      </h2>
      <ul className="space-y-2.5 text-sm">
        {goals.map(({ role, target }) => {
          const count = counts[role];
          const met = count >= target;
          return (
            <li key={role} data-goal={role} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span>{tRoles(role)}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    met ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span aria-hidden>
                    {count}/{target}
                  </span>
                  <span className="sr-only">
                    {t("progress", { count, target })}
                  </span>
                </span>
              </div>
              <span className="block h-1.5 rounded-full bg-muted" aria-hidden>
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-[width]",
                    met ? "bg-primary" : "bg-primary/40",
                  )}
                  style={{ width: `${Math.min(1, count / target) * 100}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
    </section>
  );
}
