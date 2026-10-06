import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./session";

// Caméra de la page de scan, avec la caméra simulée de Chromium (une mire de
// test), autorisée sans demande. Dans un fichier à part : ces options de
// lancement demandent un navigateur dédié.

test.use({
  locale: "fr-FR",
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test("démarre la caméra et la reconnaissance de texte", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/scan");
  await expect(
    page.getByText("Les cartes scannées s'ajoutent à votre collection."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activer la caméra" }).click();
  await expect(
    page.getByRole("button", { name: "Arrêter la caméra" }),
  ).toBeVisible();
  // Les fichiers de Tesseract.js sont servis par le site et se chargent.
  await expect(page.locator('[data-camera="running"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Arrêter la caméra" }).click();
  await expect(
    page.getByRole("button", { name: "Activer la caméra" }),
  ).toBeVisible();
});
