"use client";

import type { Active } from "@dnd-kit/core";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext } from "react";
import { Toast } from "@/components/ui/toast";
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
  return (
    <Toast
      message={refused ? text(refused) : null}
      tone="error"
      onClose={onClose}
      closeLabel={t("closeMessage")}
    />
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
