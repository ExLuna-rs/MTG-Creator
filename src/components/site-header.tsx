import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/components/auth/user-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileMenu } from "@/components/mobile-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/cards", label: "cards" },
  { href: "/decks", label: "decks" },
  { href: "/collection", label: "collection" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Header");

  const nav = (mobile: boolean) => (
    <nav
      aria-label={t("mainNav")}
      className={mobile ? "flex flex-col" : "flex items-center gap-1"}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-md font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            mobile ? "px-3 py-3 text-base" : "px-2 py-1 text-sm",
          )}
        >
          {t(link.label)}
        </Link>
      ))}
    </nav>
  );

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
          <span>MTG Creator</span>
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          {nav(false)}
          <UserMenu />
          <LocaleSwitcher />
        </div>
        {/* Sur mobile, tout passe dans le menu « burger ». */}
        <div className="md:hidden">
          <MobileMenu>
            {nav(true)}
            <div className="border-t pt-4">
              <UserMenu inMenu />
            </div>
            <LocaleSwitcher />
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
