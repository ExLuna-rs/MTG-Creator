import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useTranslations("Header");

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="size-4" aria-hidden />
          </span>
          MTG Creator
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
