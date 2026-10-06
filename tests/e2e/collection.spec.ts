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
  page.locator(`main [data-card="${name}"]`);

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
  await expect(page.getByRole("status")).toContainText(
    "Sol Ring ajoutée à la collection",
  );
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

test("relie un téléphone par QR code et suit ses scans en direct", async ({
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
  await expect(dialog.getByRole("status")).toHaveText(
    "En attente du téléphone…",
  );

  const url = await dialog.getByTestId("scan-link").getAttribute("href");
  expect(url).toMatch(/\/fr\/scan#[A-Za-z0-9_-]{43}$/);
  const phone = await openPhone(browser, url ?? "");
  await expect(
    phone.getByText(`Relié à la collection de ${name}`),
  ).toBeVisible();
  // Le jeton quitte l'adresse affichée dès l'ouverture de la page.
  expect(new URL(phone.url()).hash).toBe("");
  await expect(dialog.getByRole("status")).toHaveText("Téléphone connecté");

  // Ajout par le nom (la caméra n'est pas disponible dans ce test).
  await pickCard(phone, "Ajouter par le nom", "Lightning Bolt");
  await expect(phone.getByRole("status")).toContainText(
    "Lightning Bolt ajoutée",
  );
  await pickCard(phone, "Ajouter par le nom", "Counterspell");
  await expect(dialog.getByRole("listitem")).toHaveText([
    "Lightning Bolt",
    "Counterspell",
  ]);
  // La collection affichée derrière la fenêtre suit aussi.
  await expect(collectionCard(page, "Counterspell")).toBeAttached();

  // Annuler sur le téléphone retire l'exemplaire de la collection.
  await phone
    .getByRole("button", { name: "Retirer Counterspell de la collection" })
    .click();
  await expect(phone.locator('[data-card="Counterspell"]')).toHaveCount(0);
  await expect(dialog.getByRole("listitem")).toHaveText(["Lightning Bolt"]);
  await expect(collectionCard(page, "Counterspell")).toHaveCount(0);

  // Déconnecter le téléphone rend le lien inutilisable.
  await dialog
    .getByRole("button", { name: "Déconnecter le téléphone" })
    .click();
  await expect(dialog).toBeHidden();
  await phone.reload();
  await expect(phone.getByText("Ce lien de scan a expiré.")).toBeVisible();

  await page.reload();
  await expect(collectionCard(page, "Lightning Bolt")).toBeVisible();
  await expect(collectionCard(page, "Counterspell")).toHaveCount(0);
  await phone.context().close();
});

test("demande un lien ou une connexion pour scanner", async ({ page }) => {
  await page.goto("/fr/scan");
  await expect(page.getByText(/connectez-vous sur ce téléphone/)).toBeVisible();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Fscan$/);
});
