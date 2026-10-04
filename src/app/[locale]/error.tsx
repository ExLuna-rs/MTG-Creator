"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Erreur inattendue dans une page (base de données indisponible…). Le
// message d'origine n'est pas affiché : il peut contenir des détails internes.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="font-semibold text-3xl tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button variant="outline" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </div>
  );
}
