"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Ajoute ou retire des exemplaires d'une carte de la collection, puis
 * recharge la page pour afficher la collection à jour.
 */
export function useCollectionChange() {
  const t = useTranslations("CollectionPage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function change(oracleId: string, delta: number): Promise<boolean> {
    setError(null);
    try {
      const response = await fetch("/api/collection/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracleId, delta }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setError(t("error"));
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  return { change, pending, error };
}
