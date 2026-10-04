import { expect, type Page, test } from "@playwright/test";

// Ces tests passent aussi bien sur le jeu de test (172 cartes, en CI) que
// sur la base complète : ils ne supposent rien du nombre de résultats.

const CARD_URL = /\/fr\/cards\/[0-9a-f-]{36}$/;

test.use({ locale: "fr-FR" });

test.beforeEach(async ({ page }) => {
  // Pas de dépendance au CDN de Scryfall : les images ne sont pas chargées.
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
});

const nameField = (page: Page) =>
  page.getByRole("combobox", { name: "Nom de la carte" });
// Section des résultats, nommée par son titre (« 172 cartes », « 3 cards »).
const results = (page: Page) =>
  page.getByRole("region", { name: /(cartes?|cards?)$/ }).getByRole("listitem");
// Le lien d'une carte contient son nom puis son prix.
const cardLink = (page: Page, name: string) =>
  results(page).getByRole("link", {
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`),
  });
// Le tri est aussi une liste d'options : on cible celle des suggestions.
const suggestions = (page: Page) =>
  page.getByRole("listbox", { name: "Cartes suggérées" });
const openFilters = (page: Page) =>
  page.locator("summary").filter({ hasText: "Filtres" }).click();

async function searchByName(page: Page, name: string) {
  await nameField(page).fill(name);
  await nameField(page).press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`[?&]q=${encodeURIComponent(name).replace(/%20/g, "\\+")}`),
  );
}

test("mène à la recherche depuis l'en-tête et l'accueil", async ({ page }) => {
  await page.goto("/fr");
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Cartes" })
    .click();
  await expect(page).toHaveURL(/\/fr\/cards$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Recherche de cartes" }),
  ).toBeVisible();

  await page.goto("/fr");
  await page.getByRole("link", { name: "Rechercher des cartes" }).click();
  await expect(page).toHaveURL(/\/fr\/cards$/);
});

test("trouve une carte sans accents ni orthographe exacte", async ({
  page,
}) => {
  await page.goto("/fr/cards");
  await searchByName(page, "jotun");
  await expect(cardLink(page, "Jötun Grunt")).toBeVisible();

  await searchByName(page, "ligtning bolt");
  await expect(results(page).first()).toHaveText(/^Lightning Bolt/);
});

test("propose des noms pendant la saisie", async ({ page }) => {
  await page.goto("/fr/cards");
  await nameField(page).pressSequentially("atrax");
  const option = suggestions(page).getByRole("option", {
    name: "Atraxa, Praetors' Voice",
  });
  await expect(option).toBeVisible();
  await expect(nameField(page)).toHaveAttribute("aria-expanded", "true");

  await option.click();
  await expect(page).toHaveURL(CARD_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: "Atraxa, Praetors' Voice" }),
  ).toBeVisible();
});

test("choisit une suggestion au clavier", async ({ page }) => {
  await page.goto("/fr/cards");
  // Attend les suggestions de la saisie complète, pas d'une saisie partielle.
  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/api/cards/suggest?q=sol+rin"),
  );
  await nameField(page).pressSequentially("sol rin");
  await response;
  await expect(suggestions(page).getByRole("option").first()).toBeVisible();

  await nameField(page).press("ArrowDown");
  const active = suggestions(page).getByRole("option", { selected: true });
  await expect(active).toHaveCount(1);
  const name = await active.textContent();
  await nameField(page).press("Enter");
  await expect(page).toHaveURL(CARD_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: name ?? "" }),
  ).toBeVisible();
});

test("ferme les suggestions avec Échap", async ({ page }) => {
  await page.goto("/fr/cards");
  await nameField(page).pressSequentially("counter");
  await expect(suggestions(page).getByRole("option").first()).toBeVisible();
  await nameField(page).press("Escape");
  await expect(suggestions(page)).toBeHidden();
  await expect(nameField(page)).toHaveAttribute("aria-expanded", "false");
});

test("filtre par identité couleur", async ({ page }) => {
  await page.goto("/fr/cards?q=lightning+bolt");
  const bolt = cardLink(page, "Lightning Bolt");
  await expect(bolt).toBeVisible();

  await openFilters(page);
  await page.getByRole("checkbox", { name: "Bleu" }).check();
  await page.getByRole("button", { name: "Rechercher" }).first().click();
  await expect(page).toHaveURL(/[?&]color=U/);
  await expect(bolt).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Bleu" }).uncheck();
  await page.getByRole("checkbox", { name: "Rouge" }).check();
  await page.getByRole("button", { name: "Rechercher" }).first().click();
  await expect(page).toHaveURL(/[?&]color=R/);
  await expect(bolt).toBeVisible();
});

test("filtre par type et garde les filtres ouverts", async ({ page }) => {
  await page.goto("/fr/cards?q=lightning+bolt&type=Creature");
  // Un filtre actif : le panneau des filtres est ouvert et le signale.
  await expect(page.getByRole("checkbox", { name: "Créature" })).toBeChecked();
  await expect(page.getByText("1 filtre actif")).toBeAttached();
  await expect(cardLink(page, "Lightning Bolt")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Créature" }).uncheck();
  await page.getByRole("checkbox", { name: "Éphémère" }).check();
  await page.getByRole("button", { name: "Rechercher" }).first().click();
  await expect(page).toHaveURL(/[?&]type=Instant/);
  await expect(cardLink(page, "Lightning Bolt")).toBeVisible();
});

test("relance la recherche dès que le tri change", async ({ page }) => {
  await page.goto("/fr/cards?q=bolt");
  const sort = page.getByLabel("Trier par");
  await expect(sort).toHaveValue("");
  await sort.selectOption("manaValue");
  await expect(page).toHaveURL(/[?&]q=bolt&sort=manaValue$/);
  await expect(sort).toHaveValue("manaValue");
});

test("parcourt les pages de résultats", async ({ page }) => {
  await page.goto("/fr/cards");
  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await expect(pagination).toContainText(/Page 1 sur \d+/);

  await pagination.getByRole("link", { name: "Page suivante" }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(pagination).toContainText(/Page 2 sur \d+/);

  await pagination.getByRole("link", { name: "Page précédente" }).click();
  await expect(page).toHaveURL(/\/fr\/cards$/);
  await expect(pagination).toContainText(/Page 1 sur \d+/);
});

test("garde le formulaire synchronisé avec l'URL", async ({ page }) => {
  await page.goto("/fr/cards");
  await searchByName(page, "sol ring");
  await searchByName(page, "counterspell");

  await page.goBack();
  await expect(page).toHaveURL(/[?&]q=sol\+ring/);
  await expect(nameField(page)).toHaveValue("sol ring");

  await openFilters(page);
  await page.getByRole("link", { name: "Réinitialiser" }).click();
  await expect(page).toHaveURL(/\/fr\/cards$/);
  await expect(nameField(page)).toHaveValue("");
});

test("affiche la fiche d'une carte recto verso", async ({ page }) => {
  await page.goto("/fr/cards?q=delver+of+secrets");
  await cardLink(page, "Delver of Secrets").click();
  await expect(page).toHaveURL(CARD_URL);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Delver of Secrets // Insectile Aberration",
    }),
  ).toBeVisible();
  for (const face of ["Delver of Secrets", "Insectile Aberration"]) {
    await expect(
      page.getByRole("heading", { level: 2, name: face }),
    ).toBeVisible();
  }
  await expect(page.getByText("Force / endurance : 3/2")).toBeVisible();
  await expect(page.getByText("Commander : Légale")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voir sur Scryfall" }),
  ).toHaveAttribute("href", /^https:\/\/scryfall\.com\//);

  await page.getByRole("link", { name: "Retour à la recherche" }).click();
  await expect(page).toHaveURL(/\/fr\/cards$/);
});

test("signale les commandants et les Game Changers", async ({ page }) => {
  await page.goto("/fr/cards?q=atraxa+praetors+voice");
  await cardLink(page, "Atraxa, Praetors' Voice").click();
  await expect(page.getByText("Peut être commandant")).toBeVisible();

  await page.goto("/fr/cards?q=rhystic+study");
  await cardLink(page, "Rhystic Study").click();
  await expect(page.getByText("Game Changer", { exact: true })).toBeVisible();
});

test("répond 404 pour une carte inconnue ou un identifiant invalide", async ({
  page,
}) => {
  for (const id of ["00000000-0000-0000-0000-000000000000", "pas-un-id"]) {
    const response = await page.goto(`/fr/cards/${id}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page introuvable" }),
    ).toBeVisible();
  }
});

test("propose la recherche en anglais", async ({ page }) => {
  await page.goto("/en/cards?q=sol+ring");
  await expect(
    page.getByRole("heading", { level: 1, name: "Card search" }),
  ).toBeVisible();
  await expect(results(page).first()).toHaveText(/^Sol Ring/);
});

test("suggère des noms via l'API", async ({ request }) => {
  const response = await request.get("/api/cards/suggest?q=atrax");
  expect(response.status()).toBe(200);
  const { cards } = await response.json();
  expect(cards[0]).toMatchObject({ name: "Atraxa, Praetors' Voice" });

  const tooShort = await request.get("/api/cards/suggest?q=a");
  expect(await tooShort.json()).toEqual({ cards: [] });
});
