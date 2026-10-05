"use client";

import { LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { resetPasswordSchema } from "@/domain/auth/forms";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

/** Choix d'un nouveau mot de passe, avec le jeton reçu par email. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("ResetPasswordPage");
  const router = useRouter();

  const form = useAuthForm(resetPasswordSchema, async (data) => {
    const response = await authClient.resetPassword({
      newPassword: data.password,
      token,
    });
    if (!response.error) {
      router.replace({ pathname: "/sign-in", query: { reset: "1" } });
    }
    return response;
  });

  return (
    <form
      method="post"
      noValidate
      onSubmit={form.onSubmit}
      className="space-y-4"
    >
      {form.formError && (
        <FormMessage variant="error">
          {form.formError}{" "}
          {form.errorKey === "invalidToken" && (
            <Link href="/forgot-password" className="underline">
              {tPage("requestNewLink")}
            </Link>
          )}
        </FormMessage>
      )}
      <FormField
        id="reset-password"
        name="password"
        type="password"
        label={t("newPassword")}
        hint={t("passwordHint")}
        icon={LockKeyhole}
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        error={form.fieldError("password")}
      />
      <FormField
        id="reset-password-confirm"
        name="confirmPassword"
        type="password"
        label={t("confirmPassword")}
        icon={LockKeyhole}
        autoComplete="new-password"
        required
        error={form.fieldError("confirmPassword")}
      />
      <SubmitButton pending={form.pending}>{tPage("submit")}</SubmitButton>
    </form>
  );
}
