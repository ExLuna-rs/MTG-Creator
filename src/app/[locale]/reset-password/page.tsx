import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "ResetPasswordPage",
  });
  return { title: t("title") };
}

// Le lien de l'email passe par /api/auth/reset-password/…, qui vérifie le
// jeton puis redirige ici avec ?token=… ou ?error=INVALID_TOKEN.
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("ResetPasswordPage");
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && token && !error;

  return (
    <AuthCard title={t("title")} description={validToken && t("description")}>
      {validToken ? (
        <ResetPasswordForm token={token} />
      ) : (
        <FormMessage variant="error">
          {t("invalidLink")}{" "}
          <Link href="/forgot-password" className="underline">
            {t("requestNewLink")}
          </Link>
        </FormMessage>
      )}
    </AuthCard>
  );
}
