import { expect, type Page, test } from "@playwright/test";
import { signUpViaApi } from "./session";

// Rangement de « Mes decks » (dossiers, favoris, filtres, tris) et de la
// collection (filtres, classeurs), sur le jeu de cartes de test (make seed).

test.use({ locale: "fr-FR", viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  // Pas de dépendance au CDN de Scryfall : les images ne sont pas chargées.
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
});

async function createDeck(page: Page, commander: string) {
  await page.goto("/fr/decks/new");
  await page.getByLabel("Rechercher un commandant").fill(commander.slice(0, 8));
  await page.getByRole("button", { name: commander, exact: true }).click();
  await page.getByRole("button", { name: "Créer le deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks\/[0-9a-f-]+\/edit$/);
}

/** Noms des decks affichés, dans l'ordre. */
const deckNames = (page: Page) =>
  page.getByTestId("deck-list").locator("[data-deck]");

const ATRAXA = "Atraxa, Praetors' Voice";
const KOZILEK = "Kozilek, the Great Distortion";
const GISELA = "Gisela, the Broken Blade";

test("range les decks dans des dossiers et des favoris", async ({ page }) => {
  await signUpViaApi(page);
  for (const name of [ATRAXA, KOZILEK, GISELA]) await createDeck(page, name);
  await page.goto("/fr/decks");
  const folders = page.getByRole("navigation", { name: "Dossiers" });

  // Création d'un dossier, puis rangement par le menu du deck.
  await folders.getByRole("button", { name: "Nouveau dossier" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau dossier" });
  await dialog.getByLabel("Nom du dossier").fill("Multijoueur");
  await dialog.getByRole("button", { name: "Créer le dossier" }).click();
  await expect(
    folders.getByRole("link", { name: /Multijoueur/ }),
  ).toBeVisible();

  // Un nom déjà pris est refusé, sans tenir compte de la casse.
  await folders.getByRole("button", { name: "Nouveau dossier" }).click();
  await dialog.getByLabel("Nom du dossier").fill("multijoueur");
  await dialog.getByRole("button", { name: "Créer le dossier" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Un dossier porte déjà ce nom.",
  );
  await dialog.getByRole("button", { name: "Annuler" }).click();

  await page.getByRole("button", { name: `Options de ${KOZILEK}` }).click();
  await page.getByRole("menuitemradio", { name: "Multijoueur" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "est rangé dans" }),
  ).toHaveText(`${KOZILEK} est rangé dans « Multijoueur ».`);
  await folders.getByRole("link", { name: /Multijoueur/ }).click();
  await expect(page).toHaveURL(/folder=/);
  await expect(deckNames(page)).toHaveCount(1);
  await expect(deckNames(page).first()).toHaveAttribute("data-deck", KOZILEK);

  // Le favori passe en tête de « Tous les decks » et a sa propre vue.
  await folders.getByRole("link", { name: /Tous les decks/ }).click();
  await page
    .getByRole("button", { name: `Mettre ${GISELA} en favori` })
    .click();
  await expect(
    page.getByRole("button", { name: `Retirer ${GISELA} des favoris` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Trier par").selectOption("name");
  await expect(deckNames(page)).toHaveCount(3);
  await expect(deckNames(page).nth(0)).toHaveAttribute("data-deck", GISELA);
  await expect(deckNames(page).nth(1)).toHaveAttribute("data-deck", ATRAXA);
  await folders.getByRole("link", { name: /Favoris/ }).click();
  await expect(deckNames(page)).toHaveCount(1);

  // Supprimer le dossier garde ses decks, désormais sans dossier.
  await folders.getByRole("link", { name: /Tous les decks/ }).click();
  await folders
    .getByRole("button", { name: "Options du dossier Multijoueur" })
    .click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page
    .getByRole("dialog", { name: "Supprimer « Multijoueur » ?" })
    .getByRole("button", { name: "Supprimer le dossier" })
    .click();
  await expect(folders.getByRole("link", { name: /Multijoueur/ })).toHaveCount(
    0,
  );
  await folders.getByRole("link", { name: /Sans dossier/ }).click();
  await expect(deckNames(page)).toHaveCount(3);
});

test("cherche et filtre les decks par couleur", async ({ page }) => {
  await signUpViaApi(page);
  for (const name of [ATRAXA, KOZILEK, GISELA]) await createDeck(page, name);
  await page.goto("/fr/decks");

  await page.getByLabel("Rechercher un deck").fill("gisela");
  await expect(deckNames(page)).toHaveCount(1);
  await expect(page).toHaveURL(/q=gisela/);
  await page.getByLabel("Rechercher un deck").fill("");
  await expect(deckNames(page)).toHaveCount(3);

  // Identité avec du blanc : Atraxa et Gisela, pas Kozilek (incolore).
  await page.getByRole("button", { name: "Identité avec Blanc" }).click();
  await expect(deckNames(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Identité avec Bleu" }).click();
  await expect(page).toHaveURL(/colors=WU/);
  await expect(deckNames(page)).toHaveCount(1);
  await expect(deckNames(page).first()).toHaveAttribute("data-deck", ATRAXA);

  // Tri par couleurs : monocolores d'abord, incolores en dernier.
  await page.getByRole("button", { name: "Identité avec Blanc" }).click();
  await page.getByRole("button", { name: "Identité avec Bleu" }).click();
  await page.getByLabel("Trier par").selectOption("color");
  await expect(page).toHaveURL(/sort=color/);
  await expect(deckNames(page)).toHaveCount(3);
  await expect(deckNames(page).nth(0)).toHaveAttribute("data-deck", GISELA);
  await expect(deckNames(page).nth(2)).toHaveAttribute("data-deck", KOZILEK);
});

/** Choisit une carte dans les suggestions d'un champ « nom de la carte ». */
async function addCard(page: Page, name: string, copies: number) {
  await page.getByRole("combobox", { name: "Ajouter une carte" }).fill(name);
  await page.getByRole("option", { name, exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `${name} ajoutée` }),
  ).toBeVisible();
  for (let copy = 1; copy < copies; copy++) {
    await page
      .getByRole("button", { name: `Ajouter un exemplaire de ${name}` })
      .click();
    await expect(
      page.getByTestId("collection-grid").locator(`[data-card="${name}"]`),
    ).toContainText(`${copy + 1} exemplaires`);
  }
}

const gridCards = (page: Page) =>
  page.getByTestId("collection-grid").locator("[data-card]");

test("filtre la collection comme la recherche de cartes", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/collection");
  await addCard(page, "Lightning Bolt", 1);
  await addCard(page, "Sol Ring", 1);
  await expect(gridCards(page)).toHaveCount(2);

  // Filtres repliés par défaut.
  const filters = page.locator("summary").filter({ hasText: "Filtres" });
  await expect(page.getByRole("checkbox", { name: "Éphémère" })).toBeHidden();
  await filters.click();
  await page.getByRole("checkbox", { name: "Éphémère" }).check();
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page).toHaveURL(/type=Instant/);
  await expect(gridCards(page)).toHaveCount(1);
  await expect(gridCards(page).first()).toHaveAttribute(
    "data-card",
    "Lightning Bolt",
  );

  // La recherche par nom garde les filtres.
  await page.getByLabel("Rechercher dans la collection").fill("sol");
  await expect(page).toHaveURL(/q=sol/);
  await expect(page).toHaveURL(/type=Instant/);
  await expect(
    page.getByText("Aucune carte de la collection ne correspond à « sol »."),
  ).toBeVisible();
  await page.getByLabel("Rechercher dans la collection").fill("");
  await expect(gridCards(page)).toHaveCount(1);

  await page.getByRole("link", { name: "Tout effacer" }).click();
  await expect(gridCards(page)).toHaveCount(2);
});

test("répartit les exemplaires entre classeurs", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/collection");
  await addCard(page, "Lightning Bolt", 3);
  await addCard(page, "Sol Ring", 1);
  const binders = page.getByRole("navigation", {
    name: "Classeurs de la collection",
  });

  for (const name of ["Classeur rouge", "À échanger"]) {
    await binders.getByRole("button", { name: "Nouveau classeur" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau classeur" });
    await dialog.getByLabel("Nom du classeur").fill(name);
    await dialog.getByRole("button", { name: "Créer le classeur" }).click();
    await expect(
      binders.getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
  }
  await expect(binders.getByRole("link", { name: /Non rangés/ })).toContainText(
    "4",
  );

  // Le détail d'une carte range ses exemplaires.
  await page
    .getByRole("link", { name: "Voir où se trouve Lightning Bolt" })
    .click();
  const storage = page.getByTestId("binder-storage");
  await storage
    .getByRole("button", { name: "Ranger dans un classeur" })
    .click();
  await page.getByRole("menuitem", { name: "Classeur rouge" }).click();
  const increase = storage.getByRole("button", {
    name: "Ranger un exemplaire de Lightning Bolt dans Classeur rouge",
  });
  await expect(increase).toBeEnabled();
  await increase.click();
  await expect(storage).toContainText("Non rangés1");
  await storage
    .getByRole("button", { name: "Ranger dans un classeur" })
    .click();
  await page.getByRole("menuitem", { name: "À échanger" }).click();
  // Tous les exemplaires sont rangés : on ne peut plus en ajouter.
  await expect(storage).toContainText("Non rangés0");
  await expect(increase).toBeDisabled();

  // Chaque classeur montre ses cartes et ses exemplaires.
  await page.getByLabel("Rechercher dans la collection").fill("");
  await expect(page).toHaveURL(/\/collection$/);
  await binders.getByRole("link", { name: /Classeur rouge/ }).click();
  await expect(page).toHaveURL(/binder=/);
  await expect(page.getByTestId("binder-count")).toHaveText(
    "2 cartes · 1 différente",
  );
  await expect(gridCards(page)).toHaveCount(1);
  await expect(page.getByTestId("binder-where").first()).toHaveText(
    "2 Classeur rouge · 1 À échanger",
  );
  await binders.getByRole("link", { name: /Non rangés/ }).click();
  await expect(gridCards(page)).toHaveCount(1);
  await expect(gridCards(page).first()).toHaveAttribute(
    "data-card",
    "Sol Ring",
  );

  // Retirer un exemplaire de la collection le sort d'un classeur.
  await binders.getByRole("link", { name: /Toute la collection/ }).click();
  await page
    .getByRole("button", { name: "Retirer un exemplaire de Lightning Bolt" })
    .click();
  await expect(
    page
      .getByTestId("collection-grid")
      .locator('[data-card="Lightning Bolt"]')
      .getByTestId("binder-where"),
  ).toHaveText("2 Classeur rouge");
});

test("importe une liste dans un classeur", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/collection");
  await addCard(page, "Sol Ring", 1);
  await page.request.post("/api/binders", { data: { name: "Terrains" } });
  await page.reload();
  const binders = page.getByRole("navigation", {
    name: "Classeurs de la collection",
  });
  await binders.getByRole("link", { name: /Terrains/ }).click();
  await expect(page).toHaveURL(/binder=/);

  await page.getByRole("button", { name: "Importer une liste" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Importer dans la collection",
  });
  await dialog.getByLabel("Ou collez la liste").fill("10 Island\n5 Forest");
  await dialog.getByRole("button", { name: "Analyser la liste" }).click();
  // Le classeur affiché est choisi d'avance.
  await expect(
    dialog.getByLabel("Ranger les exemplaires ajoutés dans"),
  ).toHaveValue(/[0-9a-f-]{36}/);
  await dialog.getByRole("button", { name: "Ajouter 15 exemplaires" }).click();
  await expect(page.getByTestId("binder-count")).toHaveText(
    "15 cartes · 2 différentes",
  );
});
