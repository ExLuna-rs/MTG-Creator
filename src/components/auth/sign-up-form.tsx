"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { signUpSchema } from "@/domain/auth/forms";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

export function SignUpForm() {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("SignUpPage");
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useAuthForm(signUpSchema, async (data) => {
    const response = await authClient.signUp.email({
      ...data,
      locale,
      // Page affichée après le clic sur le lien de confirmation.
      callbackURL: getPathname({ locale, href: "/verify-email" }),
    });
    if (!response.error) setSentTo(data.email);
    return response;
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 text-sm">
        <MailCheck className="size-8 text-primary" aria-hidden />
        <p className="font-medium text-base">{tPage("checkEmailTitle")}</p>
        <p className="text-muted-foreground">
          {tPage("checkEmail", { email: sentTo })}
        </p>
      </div>
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={form.onSubmit}
      className="space-y-4"
    >
      {form.formError && (
        <FormMessage variant="error">{form.formError}</FormMessage>
      )}
      <FormField
        id="sign-up-name"
        name="name"
        label={t("name")}
        hint={t("nameHint")}
        autoComplete="nickname"
        required
        maxLength={32}
        error={form.fieldError("name")}
      />
      <FormField
        id="sign-up-email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        error={form.fieldError("email")}
      />
      <FormField
        id="sign-up-password"
        name="password"
        type="password"
        label={t("password")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        error={form.fieldError("password")}
      />
      <SubmitButton pending={form.pending}>{tPage("submit")}</SubmitButton>
    </form>
  );
}
