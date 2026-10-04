import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { emailLink } from "./mailpit";

// Parcours des comptes : les emails sont lus dans Mailpit (service Docker).

test.use({ locale: "fr-FR" });

test.beforeEach(async ({ page }) => {
  // Une adresse IP différente par test, transmise comme le ferait Cloudflare :
  // la limitation des tentatives (active en production) ne mélange pas les tests.
  await page.setExtraHTTPHeaders({
    "cf-connecting-ip": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
});

type Account = { name: string; email: string; password: string };

function newAccount(): Account {
  const id = randomUUID().slice(0, 8);
  return {
    name: `Jace ${id}`,
    email: `jace-${id}@example.com`,
    password: `mind-sculptor-${id}`,
  };
}

const accountLink = (page: Page, name: string) =>
  page.getByRole("link", { name: `Mon compte (${name})` });

async function fillSignUp(page: Page, account: Account) {
  await page.goto("/fr/sign-up");
  await page.getByLabel("Pseudo").fill(account.name);
  await page.getByLabel("Adresse email").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(
    page.getByText(
      `Nous avons envoyé un lien de confirmation à ${account.email}`,
    ),
  ).toBeVisible();
}

/** Inscription puis clic sur le lien de confirmation : l'utilisateur est connecté. */
async function signUpAndVerify(page: Page, account: Account) {
  await fillSignUp(page, account);
  const link = await emailLink(
    page.request,
    account.email,
    "Confirmez votre adresse email",
  );
  await page.goto(link);
  await expect(
    page.getByRole("heading", { level: 1, name: "Adresse confirmée" }),
  ).toBeVisible();
  await expect(accountLink(page, account.name)).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("link", { name: "Connexion" })).toBeVisible();
}

test("vérifie les champs de l'inscription avant l'envoi", async ({ page }) => {
  await page.goto("/fr/sign-up");
  await page.getByLabel("Pseudo").fill("J");
  await page.getByLabel("Adresse email").fill("pas-une-adresse");
  await page.getByLabel("Mot de passe", { exact: true }).fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByLabel("Pseudo")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText("Le pseudo doit faire entre 2 et 32 caractères."),
  ).toBeVisible();
  await expect(
    page.getByText("Saisissez une adresse email valide."),
  ).toBeVisible();
  await expect(
    page.getByText("Le mot de passe doit faire entre 8 et 128 caractères."),
  ).toBeVisible();
});

test("crée un compte, confirme l'adresse et ouvre la session", async ({
  page,
}) => {
  const account = newAccount();
  await page.goto("/fr");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(page).toHaveURL(/\/fr\/sign-up$/);
  await fillSignUp(page, account);

  // Tant que l'adresse n'est pas confirmée, la connexion est refusée.
  await page.goto("/fr/sign-in");
  await signIn(page, account.email, account.password);
  await expect(
    page.getByText("Votre adresse email n'est pas encore confirmée."),
  ).toBeVisible();

  const link = await emailLink(
    page.request,
    account.email,
    "Confirmez votre adresse email",
  );
  await page.goto(link);
  await expect(
    page.getByRole("heading", { level: 1, name: "Adresse confirmée" }),
  ).toBeVisible();

  await accountLink(page, account.name).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Mon compte" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Connecté avec l'adresse ${account.email}.`),
  ).toBeVisible();
  await expect(
    page.getByText("Méthodes de connexion : email et mot de passe."),
  ).toBeVisible();
});

test("affiche ou masque le mot de passe", async ({ page }) => {
  await page.goto("/fr/sign-in");
  const password = page.getByLabel("Mot de passe", { exact: true });
  await password.fill("secret-123");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("envoie vers Google quand la connexion Google est configurée", async ({
  page,
}) => {
  await page.goto("/fr/sign-in");
  const google = page.getByRole("button", { name: "Continuer avec Google" });
  // Identifiants Google factices dans compose.test.yaml seulement.
  test.skip(!(await google.isVisible()), "connexion Google non configurée");

  // Google n'est pas réellement contacté : on vérifie la redirection.
  let authorizeUrl: URL | undefined;
  await page.route("https://accounts.google.com/**", (route) => {
    authorizeUrl = new URL(route.request().url());
    return route.fulfill({ body: "Google" });
  });
  await google.click();
  await expect.poll(() => authorizeUrl?.pathname).toContain("/o/oauth2");
  expect(authorizeUrl?.searchParams.get("client_id")).toBe(
    "test-client-id.apps.googleusercontent.com",
  );
  expect(authorizeUrl?.searchParams.get("redirect_uri")).toMatch(
    /\/api\/auth\/callback\/google$/,
  );
});

test("explique un échec de connexion avec Google", async ({ page }) => {
  await page.goto("/fr/sign-in?error=unable_to_link_account");
  await expect(
    page.getByText("Un compte utilise déjà cette adresse"),
  ).toBeVisible();
  await page.goto("/fr/sign-in?error=access_denied");
  await expect(
    page.getByText("La connexion avec Google n'a pas abouti."),
  ).toBeVisible();
});

test("signale un lien de confirmation invalide", async ({ page }) => {
  await page.goto(
    "/api/auth/verify-email?token=faux&callbackURL=/fr/verify-email",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Lien non valable" }),
  ).toBeVisible();
});

test("protège la page Compte et ramène dessus après la connexion", async ({
  page,
}) => {
  const account = newAccount();
  await signUpAndVerify(page, account);
  await signOut(page);

  await page.goto("/fr/settings");
  await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Fsettings$/);

  await signIn(page, account.email, "mauvais-mot-de-passe");
  await expect(
    page.getByText("Adresse email ou mot de passe incorrect."),
  ).toBeVisible();

  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/fr\/settings$/);
  await expect(accountLink(page, account.name)).toBeVisible();

  await signOut(page);
  await page.goto("/fr/settings");
  await expect(page).toHaveURL(/\/fr\/sign-in/);
});

test("réinitialise un mot de passe oublié", async ({ page }) => {
  const account = newAccount();
  await signUpAndVerify(page, account);
  await signOut(page);

  await page.goto("/fr/sign-in");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page).toHaveURL(/\/fr\/forgot-password$/);
  await page.getByLabel("Adresse email").fill(account.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByText(`Si un compte existe pour ${account.email}`),
  ).toBeVisible();

  const link = await emailLink(
    page.request,
    account.email,
    "Réinitialisez votre mot de passe",
  );
  await page.goto(link);
  await expect(page).toHaveURL(/\/fr\/reset-password\?token=/);

  const newPassword = `${account.password}-bis`;
  await page.getByLabel("Nouveau mot de passe").fill(newPassword);
  await page.getByLabel("Confirmez le mot de passe").fill("autre-chose");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(
    page.getByText("Les deux mots de passe ne correspondent pas."),
  ).toBeVisible();

  await page.getByLabel("Confirmez le mot de passe").fill(newPassword);
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(page).toHaveURL(/\/fr\/sign-in\?reset=1$/);
  await expect(
    page.getByText("Votre mot de passe a été modifié."),
  ).toBeVisible();

  await signIn(page, account.email, account.password);
  await expect(
    page.getByText("Adresse email ou mot de passe incorrect."),
  ).toBeVisible();
  await signIn(page, account.email, newPassword);
  await expect(accountLink(page, account.name)).toBeVisible();

  // Le lien ne sert qu'une fois.
  await page.goto(link);
  await expect(
    page.getByText("Ce lien a expiré ou a déjà été utilisé."),
  ).toBeVisible();
});

test("modifie le pseudo et la langue, puis supprime le compte", async ({
  page,
}) => {
  const account = newAccount();
  await signUpAndVerify(page, account);
  await page.goto("/fr/settings");

  const newName = `${account.name} bis`;
  await page.getByLabel("Pseudo").fill(newName);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  await expect(accountLink(page, newName)).toBeVisible();

  await page.getByLabel("Langue préférée").selectOption("en");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/en\/settings$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "My account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Preferred language")).toHaveValue("en");

  const deleteButton = page.getByRole("button", { name: "Delete my account" });
  await page.getByLabel("Current password").fill("wrong-password");
  await deleteButton.click();
  await expect(
    page.getByText("Tick this box to confirm the deletion."),
  ).toBeVisible();

  await page.getByLabel("I understand").check();
  await deleteButton.click();
  await expect(page.getByText("Incorrect password.")).toBeVisible();

  await page.getByLabel("Current password").fill(account.password);
  await deleteButton.click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("Incorrect email address or password."),
  ).toBeVisible();
});
