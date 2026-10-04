import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/components/auth/user-menu";
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
          {/* Sur mobile, le logo seul laisse la place à la navigation. */}
          <span className="hidden sm:inline">MTG Creator</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label={t("mainNav")} className="flex items-center gap-1">
            <Link
              href="/cards"
              className="rounded-md px-2 py-1 font-medium text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {t("cards")}
            </Link>
            <Link
              href="/decks"
              className="rounded-md px-2 py-1 font-medium text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {t("decks")}
            </Link>
          </nav>
          <UserMenu />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
