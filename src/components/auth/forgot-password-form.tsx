"use client";

import { Mail, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { forgotPasswordSchema } from "@/domain/auth/forms";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { DevMailHint } from "./dev-mail-hint";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

export function ForgotPasswordForm() {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("ForgotPasswordPage");
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useAuthForm(forgotPasswordSchema, async (data) => {
    const response = await authClient.requestPasswordReset({
      email: data.email,
      // Le lien de l'email mène à cette page, avec le jeton.
      redirectTo: getPathname({ locale, href: "/reset-password" }),
    });
    if (!response.error) setSentTo(data.email);
    return response;
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 text-sm">
        <MailCheck className="size-8 text-primary" aria-hidden />
        <p className="text-muted-foreground">
          {tPage("sent", { email: sentTo })}
        </p>
        <DevMailHint />
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
        id="forgot-password-email"
        name="email"
        type="email"
        label={t("email")}
        icon={Mail}
        autoComplete="email"
        required
        error={form.fieldError("email")}
      />
      <SubmitButton pending={form.pending}>{tPage("submit")}</SubmitButton>
    </form>
  );
}
