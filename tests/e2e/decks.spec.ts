import { expect, type Page, test } from "@playwright/test";
import { setOwnIp, signUpViaApi } from "./session";

// Construction d'un deck Commander, sur le jeu de cartes de test (make seed).

test.use({ locale: "fr-FR" });

/** Choisit un commandant (ou un partenaire) dans le formulaire « Nouveau deck ». */
async function pickCommander(page: Page, label: string, name: string) {
  await page.getByLabel(label).fill(name.slice(0, 8));
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function createDeck(page: Page, commander: string) {
  await page.goto("/fr/decks/new");
  await pickCommander(page, "Rechercher un commandant", commander);
  await page.getByRole("button", { name: "Créer le deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks\/[0-9a-f-]+\/edit$/);
}

/** Recherche une carte dans l'éditeur et l'ajoute au deck. */
async function addCard(page: Page, name: string, zone = "au deck") {
  await page.getByRole("searchbox", { name: "Nom de la carte" }).fill(name);
  await page
    .getByRole("button", { name: `Ajouter ${name} ${zone}`, exact: true })
    .click();
}

const deckRow = (page: Page, name: string) =>
  page.locator(`li[data-card="${name}"]`);

const group = (page: Page, id: string) =>
  page.locator(`section[data-group="${id}"]`);

/** Glisse une carte du deck sur un groupe, à la souris. */
async function dragTo(page: Page, name: string, target: string) {
  const handle = page.getByRole("button", { name: `Déplacer ${name}` });
  const box = await group(page, target).boundingBox();
  if (!box) throw new Error(`Groupe ${target} invisible`);
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 10 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
}

async function expectSaved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Enregistré" }),
  ).toBeVisible();
}

test("construit un deck de 100 cartes valide", async ({ page }) => {
  await signUpViaApi(page);

  await page.goto("/fr/decks");
  await expect(page.getByText("Vous n'avez pas encore de deck.")).toBeVisible();
  await page.getByRole("link", { name: "Nouveau deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks\/new$/);

  await pickCommander(
    page,
    "Rechercher un commandant",
    "Atraxa, Praetors' Voice",
  );
  // Atraxa n'a pas de partenaire : pas de deuxième étape.
  await expect(page.getByText("2. Second commandant")).toHaveCount(0);
  await page.getByRole("button", { name: "Créer le deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks\/[0-9a-f-]+\/edit$/);
  await expect(page.getByLabel("Nom du deck")).toHaveValue(
    "Atraxa, Praetors' Voice",
  );
  await expect(page.getByText("Choisissez un commandant")).toHaveCount(0);

  for (const name of ["Sol Ring", "Counterspell", "Swords to Plowshares"]) {
    await addCard(page, name);
    await expect(deckRow(page, name)).toBeVisible();
  }
  await expect(page.getByText("4 cartes : un deck Commander")).toBeVisible();

  // La recherche est limitée à l'identité couleur d'Atraxa (WUBG).
  await page
    .getByRole("searchbox", { name: "Nom de la carte" })
    .fill("Lightning");
  await expect(
    page.getByRole("button", { name: "Ajouter Lightning Greaves au deck" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ajouter Lightning Bolt au deck" }),
  ).toHaveCount(0);

  // Terrains de base : autant d'exemplaires qu'on veut.
  await addCard(page, "Island");
  await page.getByLabel("Quantité de Island").fill("96");
  await expect(
    page.getByRole("heading", { name: "Deck (100 cartes)" }),
  ).toBeVisible();
  await expect(
    page.getByText("Le deck respecte toutes les règles Commander."),
  ).toBeVisible();
  await expect(page.getByText("100 / 100")).toBeVisible();

  // Sauvegarde automatique : le deck est intact après rechargement.
  await expectSaved(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Deck (100 cartes)" }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantité de Island")).toHaveValue("96");

  // Retirer puis annuler, rétablir, annuler encore.
  await page.getByRole("button", { name: "Retirer Sol Ring" }).click();
  await expect(deckRow(page, "Sol Ring")).toHaveCount(0);
  await expect(page.getByText("99 cartes : un deck Commander")).toBeVisible();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(deckRow(page, "Sol Ring")).toBeVisible();
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await expect(deckRow(page, "Sol Ring")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(deckRow(page, "Sol Ring")).toBeVisible();

  // Les cartes à considérer ne comptent pas dans le deck.
  await page
    .getByRole("checkbox", { name: "Identité du commandant" })
    .uncheck();
  await addCard(page, "Lightning Bolt", "aux cartes à considérer");
  await expect(
    group(page, "zone:maybe").getByText("Lightning Bolt"),
  ).toBeVisible();
  await expect(
    page.getByText("Le deck respecte toutes les règles Commander."),
  ).toBeVisible();

  // Une carte hors de l'identité couleur est signalée.
  await deckRow(page, "Lightning Bolt")
    .getByRole("button", { name: "Options de Lightning Bolt" })
    .click();
  await deckRow(page, "Lightning Bolt")
    .getByRole("button", { name: "Déplacer vers : Deck" })
    .click();
  await expect(
    page.getByText(
      "Hors de l'identité couleur du commandant : Lightning Bolt.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retirer Lightning Bolt" }).click();

  await expectSaved(page);
  await page.goto("/fr/decks");
  const card = page.getByRole("link", { name: /Atraxa, Praetors' Voice/ });
  await expect(card).toContainText("100 / 100 cartes");
  await expect(card).toContainText("valide");
});

test("crée un deck avec deux commandants partenaires", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/decks/new");
  await pickCommander(
    page,
    "Rechercher un commandant",
    "Thrasios, Triton Hero",
  );
  await expect(page.getByText("2. Second commandant")).toBeVisible();
  // Seuls les partenaires possibles sont proposés.
  await page
    .getByLabel("Rechercher un partenaire ou un Background")
    .fill("atraxa");
  await expect(page.getByText("Aucune carte ne correspond.")).toBeVisible();
  await pickCommander(
    page,
    "Rechercher un partenaire ou un Background",
    "Tymna the Weaver",
  );
  await page.getByRole("button", { name: "Créer le deck" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  await expect(page.getByLabel("Nom du deck")).toHaveValue(
    "Thrasios, Triton Hero & Tymna the Weaver",
  );
  const commanders = group(page, "zone:commander");
  await expect(commanders.locator("li")).toHaveCount(2);
  await expect(page.getByText("Choisissez un commandant")).toHaveCount(0);
  await expect(page.getByText("Ces commandants ne peuvent pas")).toHaveCount(0);
});

test("range les cartes par catégorie et par glisser-déposer", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Lightning Bolt");

  // Catégorie ajoutée depuis les options de la carte.
  const solRing = deckRow(page, "Sol Ring");
  await solRing.getByRole("button", { name: "Options de Sol Ring" }).click();
  await solRing.getByLabel("Nouvelle catégorie pour Sol Ring").fill("Rampe");
  await solRing.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(group(page, "category:Rampe")).toContainText("Sol Ring");
  await expect(group(page, "category:")).toContainText("Lightning Bolt");

  // Glisser Lightning Bolt dans la catégorie Rampe, puis dans les cartes à considérer.
  const drag = (name: string, target: string) => dragTo(page, name, target);
  await drag("Lightning Bolt", "category:Rampe");
  await expect(group(page, "category:Rampe")).toContainText("Lightning Bolt");
  await drag("Lightning Bolt", "zone:maybe");
  await expect(group(page, "zone:maybe")).toContainText("Lightning Bolt");
  await expect(
    page.getByRole("heading", { name: "Deck (2 cartes)" }),
  ).toBeVisible();

  await expectSaved(page);
  await page.reload();
  await expect(group(page, "zone:maybe")).toContainText("Lightning Bolt");
});

test("regroupe les cartes par rôle et suit les objectifs du deck", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Lightning Bolt");

  // Rôles déduits du texte : regroupement par défaut et objectifs.
  const goal = (role: string) => page.locator(`li[data-goal="${role}"]`);
  await expect(group(page, "role:ramp")).toContainText("Sol Ring");
  await expect(group(page, "role:removal")).toContainText("Lightning Bolt");
  await expect(goal("ramp")).toContainText("1/10");
  await expect(goal("removal")).toContainText("1/8");

  // Déposer une carte sur un rôle lui donne la catégorie de ce rôle.
  await dragTo(page, "Lightning Bolt", "role:ramp");
  await expect(group(page, "role:ramp")).toContainText("Lightning Bolt");
  await expect(goal("ramp")).toContainText("2/10");
  await expect(goal("removal")).toContainText("0/8");
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(group(page, "category:Rampe")).toContainText("Lightning Bolt");
});

test("affiche l'aperçu d'une carte et ajuste les quantités depuis la liste", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Plains");

  // Survoler une carte l'affiche, avec son texte, dans l'aperçu de droite.
  const preview = page.getByTestId("card-preview");
  await deckRow(page, "Plains").getByText("Plains", { exact: true }).hover();
  await expect(preview).toContainText("Basic Land");
  await deckRow(page, "Sol Ring").getByText("Sol Ring").hover();
  await expect(preview).toContainText("Sol Ring");
  await expect(preview).toContainText("Artifact");

  // Terrain de base : le + ajoute un exemplaire.
  await page
    .getByRole("button", { name: "Ajouter un exemplaire de Plains" })
    .click();
  await expect(page.getByLabel("Quantité de Plains")).toHaveValue("2");

  // Carte unique : le + est bloqué par la règle du singleton, le − la retire.
  await expect(
    page.getByRole("button", { name: "Ajouter un exemplaire de Sol Ring" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retirer un exemplaire de Sol Ring" })
    .click();
  await expect(deckRow(page, "Sol Ring")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Deck (3 cartes)" }),
  ).toBeVisible();
});

test("protège les decks des autres utilisateurs", async ({ page, browser }) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  const url = page.url();
  const deckId = url.split("/").at(-2);

  const other = await browser.newPage({ locale: "fr-FR" });
  await signUpViaApi(other);
  const response = await other.goto(url);
  expect(response?.status()).toBe(404);
  const save = await other.request.put(`/api/decks/${deckId}`, {
    data: { name: "Volé", entries: [] },
  });
  expect(save.status()).toBe(404);
  await other.close();

  // Sans session : redirection vers la connexion, et API refusée.
  const anonymous = await browser.newPage({ locale: "fr-FR" });
  await setOwnIp(anonymous);
  await anonymous.goto("/fr/decks");
  await expect(anonymous).toHaveURL(/\/fr\/sign-in\?next=%2Fdecks$/);
  const anonymousSave = await anonymous.request.put(`/api/decks/${deckId}`, {
    data: { name: "Volé", entries: [] },
  });
  expect(anonymousSave.status()).toBe(401);
  const anonymousImport = await anonymous.request.post("/api/cards/resolve", {
    data: { names: ["Sol Ring"] },
  });
  expect(anonymousImport.status()).toBe(401);
  await anonymous.close();
});

test("supprime un deck", async ({ page }) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer le deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks$/);
  await expect(page.getByText("Vous n'avez pas encore de deck.")).toBeVisible();
});

test("importe une liste de cartes", async ({ page }) => {
  await signUpViaApi(page);
  await createDeck(page, "Atraxa, Praetors' Voice");

  await page.getByRole("button", { name: "Importer une liste" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Importer une liste de cartes",
  });
  await dialog
    .getByLabel("Liste de cartes")
    .fill(
      [
        "Commander",
        "1 Atraxa, Praetors' Voice",
        "",
        "Deck",
        "1x Sol Ring (CMM) 410 *F* [Ramp]",
        "1 Counterspel",
        "1 Carte qui n'existe pas du tout",
        "36 Island",
        "",
        "Sideboard",
        "1 Lightning Bolt",
      ].join("\n"),
    );
  await dialog.getByRole("button", { name: "Analyser la liste" }).click();

  await expect(dialog.getByText("39 cartes reconnues.")).toBeVisible();
  await expect(dialog.getByText("2 lignes non reconnues")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Counterspell", exact: true })
    .click();
  await expect(dialog.getByText("40 cartes reconnues.")).toBeVisible();
  await dialog.getByRole("button", { name: "Importer 40 cartes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("40 cartes importées")).toBeVisible();

  // Le commandant n'est pas ajouté une seconde fois au deck.
  await expect(deckRow(page, "Atraxa, Praetors' Voice")).toHaveCount(1);
  await expect(page.getByLabel("Quantité de Island")).toHaveValue("36");
  await expect(deckRow(page, "Counterspell")).toBeVisible();
  await expect(group(page, "zone:maybe")).toContainText("Lightning Bolt");
  await expect(
    page.getByRole("heading", { name: "Deck (39 cartes)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(group(page, "category:Ramp")).toContainText("Sol Ring");

  // Tout l'import s'annule et se rétablit en une fois.
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deck (1 cartes)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();

  await expectSaved(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Deck (39 cartes)" }),
  ).toBeVisible();
});
