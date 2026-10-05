"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { signInSchema } from "@/domain/auth/forms";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { GoogleButton } from "./google-button";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

/** Formulaire de connexion ; `returnTo` : page à afficher ensuite. */
export function SignInForm({
  returnTo,
  googleEnabled,
  oauthError,
}: {
  returnTo: string;
  googleEnabled: boolean;
  /** Erreur traduite d'une connexion avec Google. */
  oauthError?: string;
}) {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("SignInPage");
  const locale = useLocale();
  const router = useRouter();

  const form = useAuthForm(signInSchema, async (data) => {
    // Sans callbackURL : Better Auth ne redirige pas le navigateur lui-même.
    const response = await authClient.signIn.email(data);
    if (!response.error) {
      router.replace(returnTo);
      router.refresh();
    } else if (response.error.code === "EMAIL_NOT_VERIFIED") {
      // Le mot de passe est bon mais l'adresse n'est pas confirmée :
      // un nouveau lien de confirmation part par email.
      await authClient.sendVerificationEmail({
        email: data.email,
        callbackURL: getPathname({ locale, href: "/verify-email" }),
      });
    }
    return response;
  });

  return (
    <>
      {googleEnabled && <GoogleButton returnTo={returnTo} />}
      <form
        method="post"
        noValidate
        onSubmit={form.onSubmit}
        className="space-y-4"
      >
        {(form.formError ?? oauthError) && (
          <FormMessage variant="error">
            {form.formError ?? oauthError}
          </FormMessage>
        )}
        <FormField
          id="sign-in-email"
          name="email"
          type="email"
          label={t("email")}
          icon={Mail}
          autoComplete="email"
          required
          error={form.fieldError("email")}
        />
        <div className="space-y-1.5">
          <FormField
            id="sign-in-password"
            name="password"
            type="password"
            label={t("password")}
            icon={LockKeyhole}
            autoComplete="current-password"
            required
            error={form.fieldError("password")}
          />
          <Link
            href="/forgot-password"
            className="inline-block text-primary text-sm underline-offset-4 hover:underline"
          >
            {tPage("forgotPassword")}
          </Link>
        </div>
        <SubmitButton pending={form.pending}>{tPage("submit")}</SubmitButton>
      </form>
    </>
  );
}
