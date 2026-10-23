"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Durée d'affichage d'une notification (ms). */
const TOAST_DURATION = 6000;

export interface ToastMessage {
  title: string;
  detail?: string;
}

/**
 * Notification en haut à droite, sous la barre du site, qui disparaît seule. La zone `status`
 * reste toujours rendue pour que les lecteurs d'écran annoncent le message.
 */
export function Toast({
  message,
  tone = "success",
  onClose,
  closeLabel,
}: {
  message: ToastMessage | null;
  tone?: "success" | "error";
  onClose: () => void;
  closeLabel: string;
}) {
  // Le délai repart quand le texte change, pas à chaque rendu.
  const text = message ? `${message.title}\n${message.detail ?? ""}` : null;
  useEffect(() => {
    if (text === null) return;
    const timer = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [text, onClose]);

  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-end px-4"
    >
      {message && (
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-l-4 bg-background p-3 text-sm shadow-lg",
            tone === "error" ? "border-l-destructive" : "border-l-primary",
          )}
        >
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              tone === "error" ? "text-destructive" : "text-primary",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium">{message.title}</p>
            {message.detail && (
              <p className="text-muted-foreground">{message.detail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
