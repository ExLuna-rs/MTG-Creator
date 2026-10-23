import { expect, type Page, test } from "@playwright/test";
import { signUpViaApi } from "./session";

// Statut des decks et exemplaires physiques de la collection, sur le jeu de
// cartes de test (make seed).

test.use({ locale: "fr-FR" });

test.beforeEach(async ({ page }) => {
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
});

async function addToCollection(page: Page, name: string, copies = 1) {
  await page.goto("/fr/collection");
  for (let i = 0; i < copies; i++) {
    await page.getByRole("combobox", { name: "Ajouter une carte" }).fill(name);
    await page.getByRole("option", { name, exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      `${name} ajoutée à la collection`,
    );
  }
}

/** Crée un deck d'Edgar Markov avec les cartes données, et le renomme. */
async function createDeck(page: Page, name: string, cards: string[]) {
  await page.goto("/fr/decks/new");
  await page.getByLabel("Rechercher un commandant").fill("Edgar Ma");
  await page.getByRole("button", { name: "Edgar Markov", exact: true }).click();
  await page.getByRole("button", { name: "Créer le deck" }).click();
  // La première ouverture de l'éditeur peut être lente en développement.
  await expect(page).toHaveURL(/\/fr\/decks\/[0-9a-f-]+\/edit$/, {
    timeout: 20_000,
  });
  const deckName = page.getByLabel("Nom du deck");
  await deckName.fill(name);
  await deckName.press("Enter");
  for (const card of cards) {
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Rechercher une carte" });
    await dialog.getByRole("combobox", { name: "Nom de la carte" }).fill(card);
    await dialog.getByRole("option", { name: card, exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText(card);
    await page.keyboard.press("Escape");
  }
  await expect(
    page.getByRole("status").filter({ hasText: "Enregistré" }),
  ).toBeVisible();
}

const missingList = (page: Page) => page.getByTestId("missing-copies");

test("monte des decks et déplace un exemplaire de l'un à l'autre", async ({
  page,
}) => {
  // Long parcours : deux decks, puis les pages des decks et de la collection.
  test.setTimeout(90_000);
  await signUpViaApi(page);
  await addToCollection(page, "Edgar Markov", 2);
  await addToCollection(page, "Sol Ring");

  // Premier deck : monté, il prend le seul Sol Ring ; Lightning Bolt manque.
  await createDeck(page, "Vampires", ["Sol Ring", "Lightning Bolt"]);
  await expect(page.locator("[data-status=building]")).toHaveText(
    "En construction",
  );
  await page.getByRole("button", { name: "Monté", exact: true }).click();
  await expect(page.locator("[data-status=built]")).toHaveText("Construit");
  await expect(page.getByText("1 carte à trouver physiquement")).toBeVisible();
  await expect(missingList(page)).toContainText(
    /Lightning Bolt\s*pas dans votre collection/,
  );

  // Second deck : il lui manque Sol Ring, rangé dans « Vampires ».
  await createDeck(page, "Edgar aggro", ["Sol Ring"]);
  await page.getByRole("button", { name: "Monté", exact: true }).click();
  await expect(missingList(page)).toContainText("Sol Ring");
  await missingList(page)
    .getByRole("button", { name: "Prendre dans Vampires" })
    .click();
  await expect(page.locator("[data-status=playable]")).toHaveText("Jouable");
  await expect(
    page.getByText("Toutes les cartes sont là physiquement"),
  ).toBeVisible();

  // La fenêtre d'une carte dit où est son exemplaire.
  await page.locator('[data-card="Sol Ring"]').first().click();
  await expect(
    page.getByRole("dialog", { name: "Sol Ring" }).getByTestId("card-copies"),
  ).toContainText("1 sur 1 dans ce deck");
  await page.keyboard.press("Escape");

  // Mes decks : statuts, manques et filtre.
  await page.goto("/fr/decks");
  const vampires = page.getByRole("link", { name: /^Vampires/ });
  await expect(vampires).toContainText("Construit");
  await expect(vampires).toContainText("2 cartes à trouver physiquement");
  await page.getByRole("link", { name: /^Jouable/ }).click();
  await expect(page).toHaveURL(/[?&]status=playable/);
  await expect(page.getByRole("link", { name: /^Edgar aggro/ })).toBeVisible();
  await expect(vampires).toHaveCount(0);

  // Collection : la carte montre où elle est, et peut changer de deck.
  await page.goto("/fr/collection");
  const tile = page
    .getByTestId("collection-grid")
    .locator('[data-card="Sol Ring"]');
  await expect(tile.getByTestId("usage")).toContainText(
    "1 dans un deck · 0 libre · manque 1",
  );
  await tile.getByRole("link", { name: "Voir où se trouve Sol Ring" }).click();
  await expect(page).toHaveURL(/[?&]q=Sol\+Ring|q=Sol%20Ring/);
  await expect(page.getByLabel("Rechercher dans la collection")).toHaveValue(
    "Sol Ring",
  );
  const details = page
    .getByTestId("collection-details")
    .locator('[data-card="Sol Ring"]');
  await expect(details).toContainText(/Utilisée dans\s*Edgar aggro/);
  await details
    .getByRole("button", { name: "Prendre dans Edgar aggro" })
    .click();
  await expect(details).toContainText(/Utilisée dans\s*Vampires/);

  // Filtre des cartes manquantes.
  await page.getByLabel("Rechercher dans la collection").fill("");
  await page.getByRole("button", { name: "Manquantes" }).click();
  await expect(page).toHaveURL(/[?&]show=missing/);
  await expect(
    page.getByTestId("collection-grid").getByRole("listitem"),
  ).toHaveCount(1);
});
