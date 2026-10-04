import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DeckIssue, DeckValidation } from "@/domain/commander/validate";
import { cn } from "@/lib/utils";

/** Message d'un problème de validation, avec les cartes concernées. */
function IssueMessage({ issue }: { issue: DeckIssue }) {
  const t = useTranslations("DeckValidation");
  const names =
    "cards" in issue
      ? issue.cards
          .map((card) =>
            "max" in card
              ? t("copies", { name: card.name, count: card.count })
              : card.name,
          )
          .join(", ")
      : "";

  switch (issue.code) {
    case "noCommander":
      return t("noCommander");
    case "tooManyCommanders":
      return t("tooManyCommanders", { count: issue.count });
    case "deckSize":
      return t("deckSize", { count: issue.count, expected: issue.expected });
    case "gameChangers":
      return t("gameChangers", {
        count: issue.count,
        bracket: issue.minimumBracket,
        cards: names,
      });
    default:
      return t(issue.code, { cards: names });
  }
}

/** Panneau de validation : deck valide, ou liste des règles non respectées. */
export function ValidationPanel({
  validation,
}: {
  validation: DeckValidation;
}) {
  const t = useTranslations("DeckValidation");
  return (
    <section aria-labelledby="validation-title" className="space-y-3">
      <h2
        id="validation-title"
        className="flex items-baseline justify-between font-semibold"
      >
        {t("title")}
        <span
          className={cn(
            "text-sm tabular-nums",
            validation.size === 100
              ? "text-muted-foreground"
              : "text-destructive",
          )}
        >
          {t("size", { count: validation.size })}
        </span>
      </h2>
      <div aria-live="polite" className="space-y-2">
        {validation.valid && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("valid")}
          </p>
        )}
        {validation.issues.length > 0 && (
          <ul className="space-y-2">
            {validation.issues.map((issue) => {
              const Icon = issue.severity === "error" ? CircleAlert : Info;
              return (
                <li
                  key={issue.code}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                    issue.severity === "error"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "bg-muted/60",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <IssueMessage issue={issue} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
