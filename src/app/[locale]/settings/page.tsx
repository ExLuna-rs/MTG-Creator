import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { ProfileForm } from "@/components/auth/profile-form";
import { requireSession } from "@/server/auth/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "SettingsPage",
  });
  return { title: t("title") };
}

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  // Page réservée : sans session, redirection vers la connexion.
  const { user } = await requireSession(locale as Locale, "/settings");
  const t = await getTranslations("SettingsPage");

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("signedInAs", { email: user.email })}
        </p>
      </div>

      <section
        aria-labelledby="profile-title"
        className="space-y-4 rounded-xl border bg-card p-6 text-card-foreground"
      >
        <h2 id="profile-title" className="font-semibold text-lg">
          {t("profileTitle")}
        </h2>
        <ProfileForm name={user.name} preferredLocale={user.locale ?? locale} />
      </section>

      <section
        aria-labelledby="delete-title"
        className="space-y-4 rounded-xl border border-destructive/40 p-6"
      >
        <div className="space-y-1">
          <h2 id="delete-title" className="font-semibold text-lg">
            {t("deleteTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("deleteDescription")}
          </p>
        </div>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
