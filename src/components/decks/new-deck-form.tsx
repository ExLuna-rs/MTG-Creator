"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDeckAction, type NewDeckState } from "@/server/decks/actions";
import { type CommanderCandidate, CommanderPicker } from "./commander-picker";

/** Formulaire « Nouveau deck » : commandant, partenaire éventuel, nom. */
export function NewDeckForm() {
  const t = useTranslations("NewDeck");
  const [state, formAction, pending] = useActionState<NewDeckState, FormData>(
    createDeckAction,
    {},
  );
  const [commander, setCommander] = useState<CommanderCandidate | null>(null);
  const [partner, setPartner] = useState<CommanderCandidate | null>(null);

  function selectCommander(card: CommanderCandidate | null) {
    setCommander(card);
    setPartner(null);
  }

  const defaultName = [commander, partner]
    .filter((card) => card !== null)
    .map((card) => card.name)
    .join(" & ");

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <FormMessage variant="error">{t(`errors.${state.error}`)}</FormMessage>
      )}

      <section className="space-y-4">
        <h2 className="font-semibold text-lg">{t("step1")}</h2>
        <CommanderPicker
          label={t("commanderLabel")}
          selected={commander}
          onSelect={selectCommander}
        />
        <input
          type="hidden"
          name="commanderId"
          value={commander?.oracleId ?? ""}
        />
      </section>

      {commander?.pairable && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-lg">{t("step2")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("partnerHint", { name: commander.name })}
            </p>
          </div>
          <CommanderPicker
            key={commander.oracleId}
            label={t("partnerLabel")}
            pairWith={commander.oracleId}
            selected={partner}
            onSelect={setPartner}
          />
          <input
            type="hidden"
            name="partnerId"
            value={partner?.oracleId ?? ""}
          />
        </section>
      )}

      <section className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="deck-name" className="block font-medium text-sm">
            {t("nameLabel")}
          </label>
          <Input
            id="deck-name"
            name="name"
            maxLength={100}
            placeholder={defaultName || t("namePlaceholder")}
          />
          <p className="text-muted-foreground text-xs">{t("nameHint")}</p>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!commander || pending}
          aria-busy={pending || undefined}
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {t("submit")}
        </Button>
      </section>
    </form>
  );
}
