"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CardNameInput } from "@/components/cards/card-name-input";
import { useCollectionChange } from "./use-collection-change";

/** Champ « Ajouter une carte » de la collection, avec suggestions. */
export function AddCollectionCard() {
  const t = useTranslations("CollectionPage");
  const id = useId();
  const [value, setValue] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const { change, error } = useCollectionChange();

  return (
    <div className="max-w-md space-y-2">
      <label htmlFor={id} className="font-medium text-sm">
        {t("addLabel")}
      </label>
      <CardNameInput
        id={id}
        name="name"
        value={value}
        onValueChange={setValue}
        placeholder={t("addPlaceholder")}
        suggestionsLabel={t("suggestions")}
        onSelect={async (suggestion) => {
          setAdded(null);
          if (await change(suggestion.oracleId, 1)) {
            setValue("");
            setAdded(suggestion.name);
          }
        }}
      />
      <p role="status" className="min-h-5 text-sm">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          added && (
            <span className="text-muted-foreground">
              {t("added", { name: added })}
            </span>
          )
        )}
      </p>
    </div>
  );
}
