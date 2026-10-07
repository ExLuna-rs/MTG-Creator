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

test("ouvre la liste de scan par-dessus la caméra et annule un ajout", async ({
  page,
}) => {
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await signUpViaApi(page);
  await page.goto("/fr/scan");
  await page.getByRole("button", { name: "Activer la caméra" }).click();
  await expect(page.locator('[data-camera="running"]')).toBeVisible({
    timeout: 30_000,
  });

  // Le menu de la liste, en haut de la caméra, ouvre la liste modifiable.
  await page.getByRole("button", { name: "Liste de scan (vide)" }).click();
  const list = page.getByRole("dialog", { name: "Liste de scan" });
  await expect(list).toBeVisible();
  await list
    .getByRole("combobox", { name: "Ajouter par le nom" })
    .fill("Lightning Bolt");
  await page
    .getByRole("option", { name: "Lightning Bolt", exact: true })
    .click();
  await expect(list.locator('[data-card="Lightning Bolt"]')).toBeVisible();
  await list.getByRole("button", { name: "Fermer la liste de scan" }).click();

  // La carte ajoutée s'affiche en bas de la caméra, avec de quoi annuler.
  await expect(
    page.getByRole("button", { name: "Liste de scan (1 carte)" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Annuler l'ajout de Lightning Bolt" })
    .click();
  await expect(
    page.getByRole("button", { name: "Liste de scan (vide)" }),
  ).toBeVisible();
});
