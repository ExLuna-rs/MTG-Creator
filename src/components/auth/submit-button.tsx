"use client";

import { LoaderCircle } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

/**
 * Bouton d'envoi des formulaires de compte. Désactivé tant que la page n'est
 * pas interactive : ces formulaires ont besoin de JavaScript, et un envoi
 * classique ne doit jamais partir (le mot de passe finirait dans la page).
 */
export function SubmitButton({
  pending,
  children,
  variant,
}: {
  pending: boolean;
  children: ReactNode;
  variant?: "default" | "destructive";
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <Button
      type="submit"
      disabled={pending || !hydrated}
      aria-busy={pending || undefined}
      className={
        variant === "destructive"
          ? "h-11 w-full bg-destructive text-white hover:bg-destructive/90"
          : "h-11 w-full"
      }
    >
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
