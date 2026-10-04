"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Liens vers la même page dans chaque langue. */
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1 text-sm">
      {routing.locales.map((target) => (
        <Link
          key={target}
          href={pathname}
          locale={target}
          lang={target}
          aria-current={target === locale ? "true" : undefined}
          className={cn(
            "rounded-md px-2 py-1 font-medium uppercase outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
            target === locale
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="sr-only">{t(target)}</span>
          <span aria-hidden>{target}</span>
        </Link>
      ))}
    </nav>
  );
}
