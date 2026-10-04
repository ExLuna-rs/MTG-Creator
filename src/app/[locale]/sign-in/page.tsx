import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeReturnPath } from "@/domain/auth/return-path";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "SignInPage",
  });
  return { title: t("title") };
}

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("SignInPage");
  const { next, reset } = await searchParams;

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            {t("signUp")}
          </Link>
        </>
      }
    >
      {reset === "1" && (
        <FormMessage variant="success">{t("passwordReset")}</FormMessage>
      )}
      <SignInForm returnTo={safeReturnPath(next)} />
    </AuthCard>
  );
}
