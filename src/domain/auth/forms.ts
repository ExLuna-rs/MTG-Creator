// Validation des formulaires des comptes, partagée par le navigateur (retour
// immédiat) et le serveur (Better Auth et ses hooks). Les messages d'erreur
// sont des clés de traduction (espace « AuthForm.errors »).
import { z } from "zod";

export const LOCALES = ["fr", "en"] as const;

export type FieldErrorKey =
  | "required"
  | "invalidEmail"
  | "nameLength"
  | "nameCharacters"
  | "passwordLength"
  | "passwordMismatch"
  | "invalidLocale"
  | "confirmRequired";

/** Pseudo affiché : 2 à 32 caractères, sans caractères de contrôle. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "nameLength")
  .max(32, "nameLength")
  .regex(/^[^\p{C}]*$/u, "nameCharacters");

/**
 * Pseudo tiré d'un profil Google : nom affiché, ou début de l'adresse email,
 * ramené aux règles de `displayNameSchema` (l'utilisateur pourra le changer).
 */
export function displayNameFromProfile(
  name: string | undefined,
  email: string,
): string {
  const clean = (value: string) =>
    value.replace(/\p{C}/gu, "").trim().slice(0, 32).trim();
  const fromName = clean(name ?? "");
  if (fromName.length >= 2) return fromName;
  const fromEmail = clean(email.split("@")[0] ?? "");
  return fromEmail.length >= 2 ? fromEmail : "Planeswalker";
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, "required")
  .pipe(z.email("invalidEmail").max(254, "invalidEmail"));

/** Nouveau mot de passe : mêmes limites que Better Auth. */
export const newPasswordSchema = z
  .string()
  .min(8, "passwordLength")
  .max(128, "passwordLength");

/** Mot de passe saisi pour s'identifier : seulement non vide. */
const currentPasswordSchema = z
  .string()
  .min(1, "required")
  .max(128, "passwordLength");

export const localeSchema = z.enum(LOCALES, "invalidLocale");

export const signUpSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export const profileSchema = z.object({
  name: displayNameSchema,
  locale: localeSchema,
});

/** Suppression d'un compte sans mot de passe (créé avec Google). */
export const deleteAccountWithoutPasswordSchema = z.object({
  confirm: z.literal("on", "confirmRequired"),
});

export const deleteAccountSchema = z.object({
  password: currentPasswordSchema,
  // Case « Je comprends que la suppression est définitive ».
  confirm: z.literal("on", "confirmRequired"),
});

export type FieldErrors = Partial<Record<string, FieldErrorKey>>;

/** Première erreur de chaque champ, sous forme de clé de traduction. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message as FieldErrorKey;
  }
  return errors;
}

/**
 * Valide les champs d'un formulaire : données nettoyées, ou erreurs par champ.
 */
export function validateForm<T extends z.ZodType>(
  schema: T,
  values: unknown,
):
  | { data: z.output<T>; errors?: undefined }
  | { data?: undefined; errors: FieldErrors } {
  const result = schema.safeParse(values);
  return result.success
    ? { data: result.data }
    : { errors: fieldErrors(result.error) };
}
