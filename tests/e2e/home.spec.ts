import { expect, test } from "@playwright/test";

test.describe("navigateur en français", () => {
  test.use({ locale: "fr-FR" });

  test("redirige la racine vers /fr", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Construisez vos decks Commander",
      }),
    ).toBeVisible();
  });

  test("passe en anglais avec le sélecteur de langue", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Build your Commander decks",
      }),
    ).toBeVisible();
  });

  test("affiche les mentions légales", async ({ page }) => {
    await page.goto("/fr");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("Wizards of the Coast");
    await expect(
      footer.getByRole("link", { name: "Scryfall" }),
    ).toHaveAttribute("href", "https://scryfall.com");
  });

  test("affiche une page 404 traduite", async ({ page }) => {
    const response = await page.goto("/fr/page-inexistante");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page introuvable" }),
    ).toBeVisible();
  });
});

test.describe("navigateur en anglais", () => {
  test.use({ locale: "en-US" });

  test("redirige la racine vers /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test("le contrôle de santé répond avec la base de données", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test.describe("sur téléphone", () => {
  test.use({ locale: "fr-FR", viewport: { width: 390, height: 844 } });

  test("le menu burger mène aux pages et se referme", async ({ page }) => {
    await page.goto("/fr");
    // La barre ne déborde pas de l'écran.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Connexion" })).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Créer un compte" }),
    ).toBeVisible();
    await menu.getByRole("link", { name: "Cartes" }).click();
    await expect(page).toHaveURL(/\/fr\/cards/);
    await expect(menu).toBeHidden();
  });
});
