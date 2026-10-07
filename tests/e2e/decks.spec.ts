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

const spotlight = (page: Page) =>
  page.getByRole("dialog", { name: "Rechercher une carte" });

/** Ouvre la recherche (Ctrl+K) si elle est fermée. */
async function openSpotlight(page: Page) {
  if (!(await spotlight(page).isVisible())) {
    await page.keyboard.press("Control+k");
  }
  await expect(spotlight(page)).toBeVisible();
  return spotlight(page);
}

/**
 * Recherche une carte et l'ajoute au deck (ou, avec `maybe`, aux cartes à
 * considérer). `search` peut porter une quantité : « 12 island ».
 */
async function addCard(
  page: Page,
  name: string,
  { maybe = false, search = name } = {},
) {
  const dialog = await openSpotlight(page);
  await dialog.getByRole("combobox", { name: "Nom de la carte" }).fill(search);
  await dialog
    .getByRole("option", { name, exact: true })
    .click({ modifiers: maybe ? ["Shift"] : [] });
  await expect(dialog.getByRole("status")).toContainText(name);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

/** Change l'affichage du deck : Piles, Grille ou Liste. */
async function showView(page: Page, view: "Piles" | "Grille" | "Liste") {
  await page.getByRole("button", { name: view, exact: true }).click();
}

/** Une carte du deck, dans n'importe quel affichage. */
const deckRow = (page: Page, name: string) =>
  page.locator(`[data-card="${name}"]`);

const group = (page: Page, id: string) =>
  page.locator(`section[data-group="${id}"]`);

/** Une carte dans un groupe du deck. */
const cardIn = (page: Page, id: string, name: string) =>
  group(page, id).locator(`[data-card="${name}"]`);

/**
 * Glisse une carte du deck sur un groupe, à la souris : par sa poignée en
 * liste, par son image (le bandeau du nom) en piles et en grille.
 */
async function dragTo(page: Page, name: string, target: string) {
  // La souris ne sort pas de la fenêtre : la carte et le groupe visé doivent
  // y tenir ensemble, sous le bandeau de validation et de statistiques.
  await page.setViewportSize({ width: 1280, height: 1400 });
  const handle = page.getByRole("button", { name: `Déplacer ${name}` });
  const box = await group(page, target).boundingBox();
  if (!box) throw new Error(`Groupe ${target} invisible`);
  if (await handle.count()) await handle.hover();
  else await deckRow(page, name).hover({ position: { x: 30, y: 8 } });
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
  await showView(page, "Liste");

  for (const name of ["Sol Ring", "Counterspell", "Swords to Plowshares"]) {
    await addCard(page, name);
    await expect(deckRow(page, name)).toBeVisible();
  }
  await expect(page.getByText("4 cartes : un deck Commander")).toBeVisible();

  // La recherche est limitée à l'identité couleur d'Atraxa (WUBG).
  const search = await openSpotlight(page);
  await search
    .getByRole("combobox", { name: "Nom de la carte" })
    .fill("Lightning");
  await expect(
    search.getByRole("option", { name: "Lightning Greaves" }),
  ).toBeVisible();
  await expect(
    search.getByRole("option", { name: "Lightning Bolt" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Terrains de base : autant d'exemplaires qu'on veut, en une saisie.
  await addCard(page, "Island", { search: "96 island" });
  await expect(page.getByLabel("Quantité de Island")).toHaveValue("96");
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
  await (await openSpotlight(page))
    .getByRole("checkbox", { name: "Identité du commandant" })
    .uncheck();
  await addCard(page, "Lightning Bolt", { maybe: true });
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
  await expect(commanders.locator("[data-card]")).toHaveCount(2);
  await expect(page.getByText("Choisissez un commandant")).toHaveCount(0);
  await expect(page.getByText("Ces commandants ne peuvent pas")).toHaveCount(0);
});

test("range les cartes par catégorie et par glisser-déposer", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await showView(page, "Liste");
  await addCard(page, "Sol Ring");
  await addCard(page, "Lightning Bolt");

  // Catégorie ajoutée depuis les options de la carte.
  const solRing = deckRow(page, "Sol Ring");
  await solRing.getByRole("button", { name: "Options de Sol Ring" }).click();
  await solRing.getByLabel("Nouvelle catégorie pour Sol Ring").fill("Rampe");
  await solRing.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(cardIn(page, "category:Rampe", "Sol Ring")).toBeVisible();
  await expect(cardIn(page, "category:", "Lightning Bolt")).toBeVisible();

  // Glisser Lightning Bolt dans la catégorie Rampe, puis dans les cartes à considérer.
  const drag = (name: string, target: string) => dragTo(page, name, target);
  await drag("Lightning Bolt", "category:Rampe");
  await expect(cardIn(page, "category:Rampe", "Lightning Bolt")).toBeVisible();
  await drag("Lightning Bolt", "zone:maybe");
  await expect(cardIn(page, "zone:maybe", "Lightning Bolt")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Deck (2 cartes)" }),
  ).toBeVisible();

  await expectSaved(page);
  await page.reload();
  await expect(cardIn(page, "zone:maybe", "Lightning Bolt")).toBeVisible();
});

test("relie les cartes aux instructions de glisser-déposer dès le rendu serveur", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("hydrated")) {
      hydrationErrors.push(message.text());
    }
  });
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await page.reload();

  // Le serveur et le client doivent donner le même id aux instructions,
  // sinon la carte pointe vers un élément qui n'existe pas.
  const commander = deckRow(page, "Edgar Markov");
  await expect(commander).toBeVisible();
  const id = await commander.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${id}"]`)).toContainText(
    "Pour déplacer une carte",
  );
  expect(hydrationErrors).toEqual([]);
});

test("regroupe les cartes par rôle", async ({ page }) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Lightning Bolt");

  // Rôles déduits du texte : regroupement par défaut, en piles.
  await expect(cardIn(page, "role:ramp", "Sol Ring")).toBeVisible();
  await expect(cardIn(page, "role:removal", "Lightning Bolt")).toBeVisible();

  // Déposer une carte (son image) sur un rôle lui donne la catégorie de ce rôle.
  await dragTo(page, "Lightning Bolt", "role:ramp");
  await expect(cardIn(page, "role:ramp", "Lightning Bolt")).toBeVisible();
  await expect(group(page, "role:removal")).toHaveCount(0);
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(cardIn(page, "category:Rampe", "Lightning Bolt")).toBeVisible();
});

test("affiche l'aperçu d'une carte et ajuste les quantités depuis la liste", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Plains");
  await showView(page, "Liste");

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

test("ouvre une carte des piles et de la grille dans une fenêtre", async ({
  page,
}) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");
  await addCard(page, "Sol Ring");
  await addCard(page, "Plains", { search: "3 plains" });
  // Piles par défaut : une image par carte, la quantité sur l'image.
  await expect(
    group(page, "role:ramp").getByRole("button", { name: "Sol Ring" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Plains (3 exemplaires)" }),
  ).toBeVisible();

  // Cliquer une carte ouvre ses options : la déplacer, puis la retirer.
  await deckRow(page, "Sol Ring").click();
  const card = page.getByRole("dialog", { name: "Sol Ring" });
  await expect(card).toContainText("Artifact");
  await card
    .getByRole("button", { name: "Déplacer vers : À considérer" })
    .click();
  await expect(cardIn(page, "zone:maybe", "Sol Ring")).toBeVisible();
  await card.getByRole("button", { name: "Retirer Sol Ring" }).click();
  await expect(card).toBeHidden();
  await expect(deckRow(page, "Sol Ring")).toHaveCount(0);

  // La grille montre les mêmes cartes ; l'affichage est retenu.
  await showView(page, "Grille");
  await expect(
    page.getByRole("button", { name: "Grille", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await deckRow(page, "Plains").click();
  await page
    .getByRole("dialog", { name: "Plains" })
    .getByRole("button", { name: "Ajouter un exemplaire de Plains" })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Plains (4 exemplaires)" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Grille", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("enchaîne les ajouts au clavier dans la recherche", async ({ page }) => {
  await signUpViaApi(page);
  await createDeck(page, "Edgar Markov");

  // « / » ouvre la recherche ; Entrée ajoute, Maj+Entrée met de côté.
  await page.keyboard.press("/");
  const dialog = spotlight(page);
  const input = dialog.getByRole("combobox", { name: "Nom de la carte" });
  await expect(input).toBeFocused();
  await input.fill("Sol Ring");
  await expect(
    dialog.getByRole("option", { name: "Sol Ring", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(dialog.getByRole("status")).toHaveText(
    "Sol Ring ajouté au deck",
  );
  await expect(input).toHaveValue("");
  await input.fill("Lightning Bolt");
  await expect(
    dialog.getByRole("option", { name: "Lightning Bolt", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await input.press("Shift+Enter");
  await expect(dialog.getByRole("status")).toHaveText(
    "Lightning Bolt ajouté aux cartes à considérer",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(cardIn(page, "role:ramp", "Sol Ring")).toBeVisible();
  await expect(cardIn(page, "zone:maybe", "Lightning Bolt")).toBeVisible();
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
  await showView(page, "Liste");
  await expect(deckRow(page, "Atraxa, Praetors' Voice")).toHaveCount(1);
  await expect(page.getByLabel("Quantité de Island")).toHaveValue("36");
  await expect(deckRow(page, "Counterspell")).toBeVisible();
  await expect(cardIn(page, "zone:maybe", "Lightning Bolt")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Deck (39 cartes)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await expect(cardIn(page, "category:Ramp", "Sol Ring")).toBeVisible();

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
