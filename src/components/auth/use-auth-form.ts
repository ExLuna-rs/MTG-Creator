"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import type { z } from "zod";
import { type AuthErrorKey, authErrorKey } from "@/domain/auth/errors";
import {
  type FieldErrorKey,
  type FieldErrors,
  validateForm,
} from "@/domain/auth/forms";

type AuthResponse = {
  error?: { code?: string; status?: number } | null;
};

/**
 * Logique commune des formulaires de compte : validation avec Zod dans le
 * navigateur, puis appel à Better Auth (qui valide de nouveau côté serveur).
 */
export function useAuthForm<T extends z.ZodType>(
  schema: T,
  submit: (data: z.output<T>) => Promise<AuthResponse>,
) {
  const t = useTranslations("AuthForm.errors");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = validateForm(schema, values);
    setError(null);
    if (result.errors) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    startTransition(async () => {
      const response = await submit(result.data);
      if (response.error) setError(authErrorKey(response.error));
    });
  }

  return {
    onSubmit,
    pending,
    /** Message d'erreur traduit d'un champ. */
    fieldError: (field: string) => {
      const key: FieldErrorKey | undefined = fieldErrors[field];
      return key ? t(key) : undefined;
    },
    /** Message d'erreur traduit renvoyé par le serveur. */
    formError: error ? t(error) : undefined,
    errorKey: error,
  };
}
