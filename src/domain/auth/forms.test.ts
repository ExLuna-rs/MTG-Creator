import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import {
  deleteAccountSchema,
  displayNameSchema,
  LOCALES,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  validateForm,
} from "./forms";

describe("displayNameSchema", () => {
  it("accepte un pseudo et retire les espaces autour", () => {
    expect(displayNameSchema.parse("  Jace  ")).toBe("Jace");
    expect(displayNameSchema.parse("Élise la Planeswalker")).toBe(
      "Élise la Planeswalker",
    );
  });

  it("refuse un pseudo trop court ou trop long", () => {
    expect(displayNameSchema.safeParse("J").success).toBe(false);
    expect(displayNameSchema.safeParse(" a ").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(33)).success).toBe(false);
  });

  it("refuse les caractères de contrôle", () => {
    expect(displayNameSchema.safeParse("Jace\u0000").success).toBe(false);
    expect(displayNameSchema.safeParse("Ja\nce").success).toBe(false);
  });
});

describe("validateForm", () => {
  it("renvoie les données nettoyées d'une inscription valide", () => {
    const result = validateForm(signUpSchema, {
      name: " Chandra ",
      email: " chandra@example.com ",
      password: "fireball123",
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      name: "Chandra",
      email: "chandra@example.com",
      password: "fireball123",
    });
  });

  it("renvoie la première erreur de chaque champ sous forme de clé", () => {
    const result = validateForm(signUpSchema, {
      name: "C",
      email: "pas-une-adresse",
      password: "court",
    });
    expect(result.errors).toEqual({
      name: "nameLength",
      email: "invalidEmail",
      password: "passwordLength",
    });
  });

  it("signale les champs vides de la connexion", () => {
    expect(
      validateForm(signInSchema, { email: "", password: "" }).errors,
    ).toEqual({ email: "required", password: "required" });
  });

  it("vérifie que les deux mots de passe correspondent", () => {
    expect(
      validateForm(resetPasswordSchema, {
        password: "nouveau-mot-de-passe",
        confirmPassword: "autre-mot-de-passe",
      }).errors,
    ).toEqual({ confirmPassword: "passwordMismatch" });
    expect(
      validateForm(resetPasswordSchema, {
        password: "nouveau-mot-de-passe",
        confirmPassword: "nouveau-mot-de-passe",
      }).errors,
    ).toBeUndefined();
  });

  it("n'accepte que les langues de l'interface dans le profil", () => {
    expect(
      validateForm(profileSchema, { name: "Nissa", locale: "de" }).errors,
    ).toEqual({ locale: "invalidLocale" });
    expect(
      validateForm(profileSchema, { name: "Nissa", locale: "en" }).data,
    ).toEqual({ name: "Nissa", locale: "en" });
  });

  it("exige la case de confirmation pour supprimer le compte", () => {
    expect(
      validateForm(deleteAccountSchema, { password: "secret" }).errors,
    ).toEqual({ confirm: "confirmRequired" });
    expect(
      validateForm(deleteAccountSchema, { password: "secret", confirm: "on" })
        .errors,
    ).toBeUndefined();
  });
});

it("propose les mêmes langues que le routage", () => {
  expect([...LOCALES]).toEqual([...routing.locales]);
});
