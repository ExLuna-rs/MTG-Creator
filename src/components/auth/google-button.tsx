"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** Logo « G » de Google, dans ses couleurs officielles. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

/**
 * Connexion (ou inscription) avec Google, suivie d'un séparateur avant le
 * formulaire email. `returnTo` : page à afficher ensuite, sans la langue.
 */
export function GoogleButton({ returnTo = "/" }: { returnTo?: string }) {
  const t = useTranslations("AuthForm");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function signIn() {
    startTransition(async () => {
      // Better Auth redirige le navigateur vers Google, puis vers callbackURL
      // (ou vers la page de connexion avec ?error=… en cas d'échec).
      await authClient.signIn.social({
        provider: "google",
        callbackURL: getPathname({ locale, href: returnTo }),
        errorCallbackURL: getPathname({ locale, href: "/sign-in" }),
      });
    });
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-11 w-full",
        )}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden />
        ) : (
          <GoogleLogo />
        )}
        {t("continueWithGoogle")}
      </button>
      <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-wide">
        <span className="h-px flex-1 bg-border" />
        {t("orWithEmail")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
