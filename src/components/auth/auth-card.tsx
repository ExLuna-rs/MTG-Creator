import { Check, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const MANA_BLOBS = [
  "-top-16 -left-10 bg-mana-w",
  "top-1/4 -right-16 bg-mana-u",
  "bottom-1/3 -left-20 bg-mana-b",
  "-bottom-10 right-1/4 bg-mana-r",
  "top-2/3 right-0 bg-mana-g",
];

/** Panneau décoratif affiché à côté des formulaires sur grand écran. */
function AuthAside() {
  const t = useTranslations("AuthAside");
  const points = ["save", "rules", "share"] as const;

  return (
    <aside className="relative hidden overflow-hidden rounded-l-2xl bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {MANA_BLOBS.map((blob) => (
          <span
            key={blob}
            className={`absolute size-56 rounded-full opacity-30 blur-3xl ${blob}`}
          />
        ))}
      </div>
      <div className="relative flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
          <Layers className="size-4" aria-hidden />
        </span>
        MTG Creator
      </div>
      <div className="relative space-y-6">
        <p className="text-balance font-semibold text-3xl leading-tight tracking-tight">
          {t("title")}
        </p>
        <ul className="space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                <Check className="size-3" aria-hidden />
              </span>
              <span className="text-primary-foreground/90">
                {t(`points.${point}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-primary-foreground/70 text-xs">
        {t("fanContent")}
      </p>
    </aside>
  );
}

/** Mise en page des pages de connexion, d'inscription et de mot de passe. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <div className="grid overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl shadow-primary/5 lg:grid-cols-2">
        <AuthAside />
        <div className="flex flex-col justify-center gap-8 p-6 sm:p-10">
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          <div className="space-y-6">{children}</div>
          {footer && (
            <div className="border-t pt-6 text-center text-muted-foreground text-sm">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
