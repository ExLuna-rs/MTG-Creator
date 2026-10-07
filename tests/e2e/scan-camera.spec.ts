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
  const row = list.locator('[data-card="Lightning Bolt"]');
  await expect(row).toBeVisible();

  // À un exemplaire, « − » demande confirmation avant de retirer la carte.
  const decrease = list.getByRole("button", {
    name: "Retirer un exemplaire de Lightning Bolt",
  });
  await decrease.click();
  await expect(
    list.getByText("Retirer Lightning Bolt de la liste ?"),
  ).toBeVisible();
  await list.getByRole("button", { name: "Garder" }).click();
  await expect(row).toContainText("1");

  // Glisser l'en-tête vers le bas ferme la liste.
  const handle = await list.getByTestId("scan-list-handle").boundingBox();
  if (!handle) throw new Error("En-tête de la liste introuvable");
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 80, { steps: 4 });
  await page.mouse.move(x, y + 200, { steps: 4 });
  await page.mouse.up();
  await expect(list).toBeHidden();

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

test("demande confirmation avant de retirer le dernier exemplaire", async ({
  page,
}) => {
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await signUpViaApi(page);
  await page.goto("/fr/scan");
  await page
    .getByRole("combobox", { name: "Ajouter par le nom" })
    .fill("Sol Ring");
  await page.getByRole("option", { name: "Sol Ring", exact: true }).click();
  const row = page.locator('[data-card="Sol Ring"]');
  await expect(row).toBeVisible();
  await page
    .getByRole("button", { name: "Retirer un exemplaire de Sol Ring" })
    .click();
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(
    page.getByText("Aucune carte scannée pour l'instant."),
  ).toBeVisible();
});
