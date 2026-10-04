"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { profileSchema } from "@/domain/auth/forms";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useAuthForm } from "./use-auth-form";

/** Pseudo et langue préférée de l'utilisateur connecté. */
export function ProfileForm({
  name,
  preferredLocale,
}: {
  name: string;
  preferredLocale: string;
}) {
  const t = useTranslations("AuthForm");
  const tPage = useTranslations("SettingsPage");
  const tLocale = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const localeId = useId();
  const [saved, setSaved] = useState(false);

  const form = useAuthForm(profileSchema, async (data) => {
    setSaved(false);
    const response = await authClient.updateUser(data);
    if (!response.error) {
      setSaved(true);
      // La page suit la langue choisie.
      if (data.locale !== locale) {
        router.replace("/settings", { locale: data.locale });
      }
      router.refresh();
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
        <FormMessage variant="error">{form.formError}</FormMessage>
      )}
      {saved && !form.pending && (
        <FormMessage variant="success">{tPage("saved")}</FormMessage>
      )}
      <FormField
        id="profile-name"
        name="name"
        label={t("name")}
        hint={t("nameHint")}
        defaultValue={name}
        autoComplete="nickname"
        required
        maxLength={32}
        error={form.fieldError("name")}
      />
      <div className="space-y-1.5">
        <label htmlFor={localeId} className="block font-medium text-sm">
          {tPage("locale")}
        </label>
        <select
          id={localeId}
          name="locale"
          defaultValue={preferredLocale}
          aria-describedby={`${localeId}-hint`}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        >
          {routing.locales.map((value) => (
            <option key={value} value={value} lang={value}>
              {tLocale(value)}
            </option>
          ))}
        </select>
        <p id={`${localeId}-hint`} className="text-muted-foreground text-xs">
          {tPage("localeHint")}
        </p>
      </div>
      <div className="sm:w-48">
        <SubmitButton pending={form.pending}>{tPage("save")}</SubmitButton>
      </div>
    </form>
  );
}
