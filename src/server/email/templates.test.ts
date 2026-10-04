import { describe, expect, it } from "vitest";
import { accountEmail, escapeHtml } from "./templates";

const url =
  "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Ffr";

describe("accountEmail", () => {
  it("rédige l'email de confirmation en français", () => {
    const email = accountEmail("verifyEmail", {
      locale: "fr",
      name: "Jace",
      url,
    });
    expect(email.subject).toBe("Confirmez votre adresse email");
    expect(email.text).toContain("Bonjour Jace,");
    expect(email.text).toContain(url);
    expect(email.html).toContain('lang="fr"');
    expect(email.html).toContain(escapeHtml(url));
  });

  it("rédige l'email de réinitialisation en anglais", () => {
    const email = accountEmail("resetPassword", {
      locale: "en",
      name: "Jace",
      url,
    });
    expect(email.subject).toBe("Reset your password");
    expect(email.text).toContain("Hello Jace,");
  });

  it("échappe le pseudo dans la version HTML", () => {
    const email = accountEmail("verifyEmail", {
      locale: "fr",
      name: '<img src=x onerror="alert(1)">',
      url,
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});
