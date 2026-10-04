import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "VerifyEmailPage",
  });
  return { title: t("title") };
}

// Page d'arrivée du lien de confirmation : /api/auth/verify-email confirme
// l'adresse, ouvre une session, puis redirige ici (avec ?error=… en cas
// d'échec).
export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("VerifyEmailPage");
  const { error } = await searchParams;

  if (error) {
    return (
      <AuthCard title={t("errorTitle")}>
        <FormMessage variant="error">{t("error")}</FormMessage>
        <Link
          href="/sign-in"
          className={buttonVariants({ className: "w-full" })}
        >
          {t("signIn")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")}>
      <FormMessage variant="success">{t("success")}</FormMessage>
      <Link
        href="/settings"
        className={buttonVariants({ className: "w-full" })}
      >
        {t("goToAccount")}
      </Link>
    </AuthCard>
  );
}
