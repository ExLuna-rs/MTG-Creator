import { useTranslations } from "next-intl";

/**
 * En développement, aucun email ne part vraiment : rappelle où les lire.
 * Rien n'est affiché en production.
 */
export function DevMailHint() {
  const t = useTranslations("AuthForm");
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-xs">
      {t.rich("devMailHint", {
        link: (chunks) => (
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
