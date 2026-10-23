"use client";

import type { Active } from "@dnd-kit/core";
import { CircleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect } from "react";
import type { CommanderRefusal } from "@/domain/commander/validate";

/** Carte refusée dans la zone Commandant, et la raison. */
export interface RefusedCommander {
  name: string;
  refusal: CommanderRefusal;
}

/**
 * Vérifie qu'une carte du deck (par `oracleId`) peut rejoindre les
 * commandants. Fournie par le deck, lue par les zones de dépôt et les
 * boutons « Déplacer vers Commandant ».
 */
export const CommanderCheck = createContext<
  (oracleId: string) => RefusedCommander | null
>(() => null);

/**
 * Refus de la carte en cours de glisser-déposer, quand elle survole la zone
 * Commandant (`groupId` vaut alors « zone:commander »). Une carte déjà
 * commandant n'est pas vérifiée.
 */
export function useDropRefusal(
  groupId: string,
  isOver: boolean,
  active: Active | null,
): RefusedCommander | null {
  const check = useContext(CommanderCheck);
  if (groupId !== "zone:commander" || !isOver || !active) return null;
  const [from, oracleId] = String(active.id).split("|");
  return from === "commander" || !oracleId ? null : check(oracleId);
}

/** Titre et explication d'un refus, dans la langue de l'interface. */
export function useRefusalText() {
  const t = useTranslations("DeckEditor.commanderRefused");
  return ({ name, refusal }: RefusedCommander) => {
    const values = {
      name,
      other: refusal.code === "invalidPair" ? refusal.other.name : "",
    };
    return {
      title: t(`${refusal.code}.title`, values),
      /** Sans le nom de la carte, pour les options de la carte elle-même. */
      short: t(`${refusal.code}.short`, values),
      detail: t(`${refusal.code}.detail`),
    };
  };
}

/** Durée d'affichage du message après un dépôt refusé (ms). */
const TOAST_DURATION = 6000;

/** Message affiché après un dépôt refusé ; il disparaît seul. */
export function RefusedToast({
  refused,
  onClose,
}: {
  refused: RefusedCommander | null;
  onClose: () => void;
}) {
  const t = useTranslations("DeckEditor");
  const text = useRefusalText();
  useEffect(() => {
    if (!refused) return;
    const timer = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [refused, onClose]);

  const message = refused ? text(refused) : null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
    >
      {message && (
        <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-l-4 border-l-destructive bg-background p-3 text-sm shadow-lg">
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium">{message.title}</p>
            <p className="text-muted-foreground">{message.detail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMessage")}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** Raison du refus, affichée dans la zone Commandant pendant le survol. */
export function DropRefusal({ refused }: { refused: RefusedCommander | null }) {
  const text = useRefusalText();
  if (!refused) return null;
  return (
    <p className="flex items-start gap-1.5 px-2 pb-1.5 font-medium text-destructive text-xs">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {text(refused).title}
    </p>
  );
}
