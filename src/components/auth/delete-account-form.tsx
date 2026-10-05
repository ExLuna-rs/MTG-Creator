"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import {
  deleteAccountSchema,
  deleteAccountWithoutPasswordSchema,
} from "@/domain/auth/forms";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

/**
 * Suppression définitive du compte, confirmée par le mot de passe. Un compte
 * créé avec Google n'en a pas : Better Auth exige alors une session récente.
 */
export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("SettingsPage");
  const router = useRouter();
  const confirmId = useId();

  const schema = hasPassword
    ? deleteAccountSchema
    : deleteAccountWithoutPasswordSchema;
  const form = useAuthForm(schema, async (data) => {
    const password =
      "password" in data && typeof data.password === "string"
        ? data.password
        : undefined;
    const response = await authClient.deleteUser(password ? { password } : {});
    if (!response.error) {
      router.replace("/");
      router.refresh();
    }
    return response;
  });
  const confirmError = form.fieldError("confirm");

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
      {hasPassword ? (
        <FormField
          id="delete-account-password"
          name="password"
          type="password"
          label={t("currentPassword")}
          autoComplete="current-password"
          required
          error={form.fieldError("password")}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {tPage("deleteConfirmGoogle")}
        </p>
      )}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <input
            id={confirmId}
            name="confirm"
            type="checkbox"
            required
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? `${confirmId}-error` : undefined}
            className="mt-0.5 size-4 accent-destructive"
          />
          <label htmlFor={confirmId} className="text-sm">
            {tPage("deleteConfirm")}
          </label>
        </div>
        {confirmError && (
          <p id={`${confirmId}-error`} className="text-destructive text-sm">
            {confirmError}
          </p>
        )}
      </div>
      <div className="sm:w-56">
        <SubmitButton pending={form.pending} variant="destructive">
          {tPage("delete")}
        </SubmitButton>
      </div>
    </form>
  );
}
