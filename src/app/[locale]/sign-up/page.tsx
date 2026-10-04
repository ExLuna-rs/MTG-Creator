import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "SignUpPage",
  });
  return { title: t("title") };
}

export default async function SignUpPage({
  params,
}: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("SignUpPage");

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
