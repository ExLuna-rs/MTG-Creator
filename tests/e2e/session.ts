import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { emailLink } from "./mailpit";

/**
 * Adresse IP propre au test, transmise comme le ferait Cloudflare : la
 * limitation des tentatives (active en production) ne mélange pas les tests.
 * L'en-tête est posé sur le contexte : `page.request` (appels directs à
 * l'API) l'envoie aussi, contrairement à `page.setExtraHTTPHeaders`.
 */
export async function setOwnIp(page: Page) {
  await page.context().setExtraHTTPHeaders({
    "cf-connecting-ip": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
}

/**
 * Crée un compte par l'API de Better Auth, puis suit le lien de confirmation
 * reçu dans Mailpit : la page est alors connectée à ce nouveau compte.
 */
export async function signUpViaApi(page: Page): Promise<{ name: string }> {
  const id = randomUUID().slice(0, 8);
  const account = {
    name: `Chandra ${id}`,
    email: `chandra-${id}@example.com`,
    password: `torch-of-defiance-${id}`,
  };
  await setOwnIp(page);
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: { ...account, callbackURL: "/fr/verify-email" },
  });
  expect(response.ok()).toBe(true);
  const link = await emailLink(
    page.request,
    account.email,
    "Confirmez votre adresse email",
  );
  await page.goto(link);
  await expect(
    page.getByRole("link", { name: `Mon compte (${account.name})` }),
  ).toBeVisible();
  return account;
}
