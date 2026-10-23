import {
  type Browser,
  devices,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { setOwnIp, signUpViaApi } from "./session";

// Collection de cartes et scan depuis un téléphone relié par QR code, sur le
// jeu de cartes de test (make seed).

test.use({ locale: "fr-FR" });

test.beforeEach(async ({ page }) => {
  // Pas de dépendance au CDN de Scryfall : les images ne sont pas chargées.
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
});

/** Choisit une carte dans les suggestions d'un champ « nom de la carte ». */
async function pickCard(page: Page, field: string, name: string) {
  await page.getByRole("combobox", { name: field }).fill(name);
  await page.getByRole("option", { name, exact: true }).click();
}

const collectionCard = (page: Page, name: string) =>
  page.getByTestId("collection-grid").locator(`[data-card="${name}"]`);

/** Téléphone sans session : seul le lien de scan le relie à la collection. */
async function openPhone(browser: Browser, url: string) {
  const phone = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
  });
  const page = await phone.newPage();
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await setOwnIp(page);
  await page.goto(url);
  return page;
}

test("ajoute et retire des cartes de la collection", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr");
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/collection$/);
  await expect(page.getByText("Votre collection est vide.")).toBeVisible();

  await pickCard(page, "Ajouter une carte", "Sol Ring");
  await expect(
    page.getByRole("status").filter({ hasText: "Sol Ring ajoutée" }),
  ).toContainText("Sol Ring ajoutée à la collection");
  await expect(collectionCard(page, "Sol Ring")).toContainText("1 exemplaire");

  await page
    .getByRole("button", { name: "Ajouter un exemplaire de Sol Ring" })
    .click();
  await expect(collectionCard(page, "Sol Ring")).toContainText("2 exemplaires");
  await expect(page.getByTestId("collection-count")).toContainText("2 cartes");

  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Retirer un exemplaire de Sol Ring" })
      .click();
    await expect(collectionCard(page, "Sol Ring")).toHaveCount(i === 0 ? 1 : 0);
  }
  await expect(page.getByText("Votre collection est vide.")).toBeVisible();
});

test("cherche et trie les cartes de la collection", async ({ page }) => {
  await signUpViaApi(page);
  await page.goto("/fr/collection");
  for (const name of ["Sol Ring", "Lightning Bolt", "Counterspell"]) {
    await pickCard(page, "Ajouter une carte", name);
    await expect(collectionCard(page, name)).toBeVisible();
  }
  const grid = page.getByTestId("collection-grid").getByRole("listitem");
  await expect(grid).toHaveCount(3);

  await page.getByLabel("Rechercher dans la collection").fill("bolt");
  await expect(page).toHaveURL(/[?&]q=bolt/);
  // Une recherche affiche le détail des cartes trouvées.
  const details = page.getByTestId("collection-details").getByRole("listitem");
  await expect(details).toHaveCount(1);
  await expect(details).toHaveAttribute("data-card", "Lightning Bolt");

  // La fiche d'une carte ramène à la collection, recherche comprise.
  await details.getByText("Lightning Bolt", { exact: true }).click();
  await page.getByRole("link", { name: "Retour à la collection" }).click();
  await expect(page).toHaveURL(/\/fr\/collection\?q=bolt$/);
  await expect(details).toHaveCount(1);

  await page.getByLabel("Rechercher dans la collection").fill("");
  await expect(grid).toHaveCount(3);

  // Par couleur : bleu, rouge, puis incolore.
  await page.getByLabel("Trier par").selectOption("Couleur");
  await expect(page).toHaveURL(/[?&]sort=color/);
  await expect
    .poll(() =>
      grid.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-card")),
      ),
    )
    .toEqual(["Counterspell", "Lightning Bolt", "Sol Ring"]);
});

test("relie un téléphone par QR code et valide sa liste de scan", async ({
  page,
  browser,
}) => {
  const { name } = await signUpViaApi(page);
  await page.goto("/fr/collection");
  await page
    .getByRole("button", { name: "Scanner avec mon téléphone" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Relier mon téléphone" });
  await expect(
    dialog.getByRole("img", { name: "QR code du lien de scan" }),
  ).toBeVisible();
  await expect(dialog.getByText("En attente du téléphone…")).toBeVisible();
  // Ouverte depuis localhost, l'application prévient que le lien ne marchera
  // pas sur un vrai téléphone.
  await expect(
    dialog.getByText(/Ce QR code pointe vers « localhost »/),
  ).toBeVisible();

  const url = await dialog.getByTestId("scan-link").getAttribute("href");
  expect(url).toMatch(/\/fr\/scan#[A-Za-z0-9_-]{43}$/);
  const phone = await openPhone(browser, url ?? "");
  await expect(
    phone.getByText(`Relié à la collection de ${name}`),
  ).toBeVisible();
  // Le jeton quitte l'adresse affichée dès l'ouverture de la page.
  expect(new URL(phone.url()).hash).toBe("");
  await expect(dialog.getByText("Téléphone connecté")).toBeVisible();

  // Ajout par le nom (la caméra n'est pas disponible dans ce test).
  await pickCard(phone, "Ajouter par le nom", "Lightning Bolt");
  await expect(
    phone.getByText("Lightning Bolt ajoutée à la liste"),
  ).toBeVisible();
  await pickCard(phone, "Ajouter par le nom", "Counterspell");
  const phoneRow = (card: string) => phone.locator(`[data-card="${card}"]`);
  const desktopRow = (card: string) => dialog.locator(`[data-card="${card}"]`);
  await expect(desktopRow("Counterspell")).toBeVisible();

  // Le téléphone corrige une carte mal reconnue…
  await phone.getByRole("button", { name: "Corriger Counterspell" }).click();
  await pickCard(phone, "Bonne carte à la place de Counterspell", "Cultivate");
  await expect(phoneRow("Cultivate")).toBeVisible();
  await expect(desktopRow("Cultivate")).toBeVisible();
  await expect(desktopRow("Counterspell")).toHaveCount(0);

  // … et l'ordinateur change une quantité, que le téléphone voit aussi.
  await dialog
    .getByRole("button", { name: "Ajouter un exemplaire de Lightning Bolt" })
    .click();
  await expect(phoneRow("Lightning Bolt")).toContainText("2");

  // Rien n'entre dans la collection avant la validation.
  await expect(page.getByText("Votre collection est vide.")).toBeAttached();
  await phone
    .getByRole("button", { name: "Ajouter 3 cartes à la collection" })
    .click();
  await expect(
    phone.getByText("3 cartes ajoutées à la collection"),
  ).toBeVisible();
  await expect(desktopRow("Cultivate")).toHaveCount(0);

  // Déconnecter le téléphone rend le lien inutilisable.
  await dialog
    .getByRole("button", { name: "Déconnecter le téléphone" })
    .click();
  await expect(dialog).toBeHidden();
  // Le téléphone, qui relit sa liste régulièrement, le voit tout seul.
  await expect(phone.getByText("Ce lien de scan a expiré.")).toBeVisible();

  await page.reload();
  await expect(collectionCard(page, "Lightning Bolt")).toContainText(
    "2 exemplaires",
  );
  await expect(collectionCard(page, "Cultivate")).toContainText("1 exemplaire");
  await phone.context().close();
});

test("demande un lien ou une connexion pour scanner", async ({ page }) => {
  await page.goto("/fr/scan");
  await expect(page.getByText(/connectez-vous sur ce téléphone/)).toBeVisible();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Fscan$/);
});

test("importe une liste et un fichier dans la collection, puis l'exporte", async ({
  page,
}) => {
  await signUpViaApi(page);
  await page.goto("/fr/collection");

  await page.getByRole("button", { name: "Importer une liste" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Importer dans la collection",
  });
  await dialog
    .getByLabel("Ou collez la liste")
    .fill("4 Lightning Bolt\n1 Sol Rign\n2x Counterspell (MH2) 267");
  await dialog.getByRole("button", { name: "Analyser la liste" }).click();
  await expect(
    dialog.getByText("6 exemplaires reconnus, 2 cartes différentes."),
  ).toBeVisible();
  await expect(dialog.getByText("1 ligne non reconnue")).toBeVisible();
  await dialog.getByRole("button", { name: "Sol Ring", exact: true }).click();
  await dialog.getByRole("button", { name: "Ajouter 7 exemplaires" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("7 exemplaires ajoutés")).toBeVisible();
  await expect(page.getByTestId("collection-count")).toContainText("7 cartes");

  // Un export CSV de ManaBox : les exemplaires s'ajoutent.
  await page.getByRole("button", { name: "Importer une liste" }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "manabox.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'Name,Set code,Quantity\nSol Ring,CMM,2\n"Fire // Ice",MH2,1\n',
    ),
  });
  await expect(dialog.getByText("manabox.csv")).toBeVisible();
  await dialog.getByRole("button", { name: "Analyser la liste" }).click();
  await dialog.getByRole("button", { name: "Ajouter 3 exemplaires" }).click();
  await expect(collectionCard(page, "Sol Ring")).toContainText("3 exemplaires");
  await expect(page.getByTestId("collection-count")).toContainText("10 cartes");

  await page.getByRole("button", { name: "Exporter" }).click();
  const exported = page
    .getByRole("dialog", { name: "Exporter la collection" })
    .getByRole("textbox", { name: "Liste exportée" });
  await expect(exported).toHaveValue(
    "2 Counterspell\n1 Fire // Ice\n4 Lightning Bolt\n3 Sol Ring",
  );
  await page.getByRole("radio", { name: "CSV" }).check();
  await expect(exported).toHaveValue(/^"Count","Name"\n"2","Counterspell"/);
});

test("refuse l'import dans la collection sans session", async ({ request }) => {
  const response = await request.post("/api/collection/import", {
    data: { cards: [{ oracleId: crypto.randomUUID(), quantity: 1 }] },
  });
  expect(response.status()).toBe(401);
});
