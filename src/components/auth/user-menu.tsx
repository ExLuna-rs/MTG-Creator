"use client";

import { LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navLinkClassName =
  "rounded-md px-2 py-1 font-medium text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Liens de connexion, ou compte et déconnexion. La session est lue dans le
 * navigateur : les pages publiques restent statiques et mises en cache.
 */
export function UserMenu() {
  const t = useTranslations("Header");
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  if (isPending) {
    return <div className="h-8 w-28" aria-hidden />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/sign-in" className={navLinkClassName}>
          {t("signIn")}
        </Link>
        <Link
          href="/sign-up"
          // Sur mobile, la page de connexion mène à l'inscription.
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "hidden sm:inline-flex",
          )}
        >
          {t("signUp")}
        </Link>
      </div>
    );
  }

  function signOut() {
    startSignOut(async () => {
      await authClient.signOut();
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/settings"
        aria-label={t("account", { name: session.user.name })}
        className={cn(
          navLinkClassName,
          "flex max-w-28 items-center gap-1.5 sm:max-w-48",
        )}
      >
        <UserRound className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{session.user.name}</span>
      </Link>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className={cn(
          buttonVariants({ size: "icon", variant: "ghost" }),
          "size-8",
        )}
        title={t("signOut")}
      >
        <LogOut aria-hidden />
        <span className="sr-only">{t("signOut")}</span>
      </button>
    </div>
  );
}
