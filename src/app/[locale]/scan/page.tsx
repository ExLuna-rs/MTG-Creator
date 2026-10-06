import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Scanner } from "@/components/scan/scanner";
import { getCurrentSession } from "@/server/auth/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/scan">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Scanner",
  });
  return { title: t("title"), robots: { index: false } };
}

/**
 * Scan de cartes vers la collection. Ouverte sur le téléphone, soit par
 * l'utilisateur connecté, soit par le QR code de la page « Ma collection »
 * (lien de scan dans le fragment de l'adresse, lu par la page elle-même).
 */
export default async function ScanPage({
  params,
}: PageProps<"/[locale]/scan">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const session = await getCurrentSession();
  const t = await getTranslations("Scanner");

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
      <Scanner signedIn={Boolean(session)} />
    </div>
  );
}
