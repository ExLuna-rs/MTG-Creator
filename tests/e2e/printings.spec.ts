import { expect, type Page, test } from "@playwright/test";
import { signUpViaApi } from "./session";

// Éditions des cartes : fiche, version dans un deck, filtre par extension
// (jeu de test : make seed, avec les éditions).

test.use({ locale: "fr-FR" });

const SOL_RING = "6ad8011d-3471-4369-9d68-b264cc027487";

async function createDeck(page: Page, commander: string) {
  await page.goto("/fr/decks/new");
  await page.getByLabel("Rechercher un commandant").fill(commander.slice(0, 8));
  await page.getByRole("button", { name: commander, exact: true }).click();
  await page.getByRole("button", { name: "Créer le deck" }).click();
  await expect(page).toHaveURL(/\/fr\/decks\/[0-9a-f-]+\/edit$/);
}

async function importList(page: Page, lines: string[]) {
  await page.getByRole("button", { name: "Importer une liste" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Importer une liste de cartes",
  });
  await dialog.getByLabel("Liste de cartes").fill(lines.join("\n"));
  await dialog.getByRole("button", { name: "Analyser la liste" }).click();
  await dialog.getByRole("button", { name: /^Importer \d+ cartes?$/ }).click();
  await expect(dialog).toBeHidden();
}

async function expectSaved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Enregistré" }),
  ).toBeVisible();
}

/** Ouvre la fenêtre d'une carte du deck (affichage en piles). */
async function openCard(page: Page, name: string) {
  await page.locator(`[data-card="${name}"]`).first().click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("montre les versions d'une carte sur sa fiche", async ({ page }) => {
  await page.goto(`/fr/cards/${SOL_RING}`);
  const versions = page.getByRole("region", { name: /^Versions/ });
  await expect(versions).toBeVisible();

  // Les versions spéciales (Secret Lair…) sont masquées par défaut.
  await expect(versions.getByRole("link", { name: /Secret Lair/ })).toHaveCount(
    0,
  );
  await versions
    .getByLabel("Masquer les promos et versions spéciales")
    .uncheck();
  await expect(
    versions.getByRole("link", { name: /Secret Lair/ }).first(),
  ).toBeVisible();

  // Choisir une version change l'image, les détails et les liens d'achat.
  await versions.getByRole("link", { name: /Limited Edition Alpha/ }).click();
  await expect(page).toHaveURL(/[?&]v=[0-9a-f-]+/);
  await expect(
    page.getByText("Limited Edition Alpha (LEA), n° 269"),
  ).toBeVisible();
  await expect(
    versions.getByRole("link", { name: /Limited Edition Alpha/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("link", { name: /Voir sur Cardmarket/ }),
  ).toHaveAttribute("href", /idProduct=\d+/);
});

test("choisit la version d'une carte dans un deck", async ({ page }) => {
  await signUpViaApi(page);
  await createDeck(page, "Atraxa, Praetors' Voice");
  await importList(page, ["1 Sol Ring", "1 Lightning Bolt (LEA) 161"]);

  // L'édition indiquée dans la liste importée est reprise.
  const bolt = await openCard(page, "Lightning Bolt");
  await expect(
    bolt.getByRole("button", { name: "Limited Edition Alpha, n° 161" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  const solRing = await openCard(page, "Sol Ring");
  await expect(
    solRing.getByRole("button", { name: "Par défaut" }),
  ).toHaveAttribute("aria-pressed", "true");
  await solRing
    .getByRole("button", { name: "Limited Edition Alpha, n° 269" })
    .click();
  await expect(
    solRing.getByText("Version choisie : Limited Edition Alpha, n° 269"),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // La version du commandant devient l'illustration du deck.
  const atraxa = await openCard(page, "Atraxa, Praetors' Voice");
  const commander = atraxa.getByRole("button", {
    name: "Commander 2016, n° 28",
  });
  await commander.click();
  const art = await commander.locator("img").getAttribute("src");
  const artId = art?.match(/\/([0-9a-f-]{36})\.jpg/)?.[1];
  expect(artId).toBeTruthy();
  await page.keyboard.press("Escape");

  // L'export écrit les versions choisies.
  await page.getByRole("button", { name: "Exporter" }).click();
  const exported = page.getByRole("dialog", { name: "Exporter le deck" });
  await expect(
    exported.getByRole("textbox", { name: "Liste exportée" }),
  ).toHaveValue(
    [
      "Commander",
      "1 Atraxa, Praetors' Voice (C16) 28",
      "",
      "Deck",
      "1 Lightning Bolt (LEA) 161",
      "1 Sol Ring (LEA) 269",
    ].join("\n"),
  );
  await page.keyboard.press("Escape");

  // Les choix sont enregistrés.
  await expectSaved(page);
  await page.reload();
  const reloaded = await openCard(page, "Sol Ring");
  await expect(
    reloaded.getByRole("button", { name: "Limited Edition Alpha, n° 269" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/fr/decks");
  await expect(
    page.locator(`[data-deck="Atraxa, Praetors' Voice"] img[src*="${artId}"]`),
  ).toBeVisible();
});

test("filtre les cartes par extension", async ({ page }) => {
  await page.goto("/fr/cards");
  await page.getByText("Filtres", { exact: true }).click();
  await page.getByRole("combobox", { name: "Extension" }).fill("alpha");
  await page.getByRole("option", { name: /Limited Edition Alpha/ }).click();
  await page.getByRole("button", { name: "Rechercher" }).first().click();

  await expect(page).toHaveURL(/[?&]set=lea/);
  await expect(
    page.getByRole("link", {
      name: "Retirer le filtre : Extension : Limited Edition Alpha",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "9 cartes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Sol Ring / })).toBeVisible();
});
