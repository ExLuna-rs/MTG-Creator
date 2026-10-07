# MTG Creator

Application web de création de decks *Magic: The Gathering* pour le format Commander, en français et en anglais : recherche de cartes, vérification des règles en temps réel, statistiques, import / export et partage.

> En construction. Le plan du projet et la feuille de route sont dans [`docs/PLAN.md`](docs/PLAN.md).

## Démarrer

Prérequis : **Docker** (Docker Desktop sous Windows et macOS, Docker Engine sous Linux). Rien d'autre à installer : Node.js et PostgreSQL tournent dans des conteneurs.

```bash
git clone https://github.com/ExLuna-rs/MTG-Creator.git
cd MTG-Creator
docker compose up --build
```

- Application : <http://localhost:3000>
- Emails envoyés par l'application (Mailpit) : <http://localhost:8025>
- Pour arrêter : `Ctrl+C`, puis `docker compose down`.

Le premier lancement télécharge les images et installe les dépendances : comptez quelques minutes. Ensuite, chaque modification du code est rechargée automatiquement dans le navigateur.

La base de cartes est vide au départ. Importez les cartes depuis Scryfall (environ 25 Mo, une trentaine de secondes), depuis un autre terminal :

```bash
docker compose run --rm --build app pnpm cards:sync
```

ou, sans accès à Internet, le jeu de test de 172 cartes : `docker compose run --rm --build app pnpm cards:seed`. Les mêmes commandes s'écrivent `make sync` et `make seed`.

Pour tester les comptes, créez-en un sur <http://localhost:3000/fr/sign-up> : en développement, aucun email ne part vraiment, le lien de confirmation (comme celui du mot de passe oublié) arrive dans Mailpit, sur <http://localhost:8025>.

Une fois connecté, « Mes decks » (<http://localhost:3000/fr/decks>) permet de créer un deck à partir d'un commandant puis de le construire dans l'éditeur.

« Collection » (<http://localhost:3000/fr/collection>) liste les cartes possédées. Le bouton « Scanner avec mon téléphone » affiche un QR code qui ouvre la page de scan sur le téléphone, reliée au compte : les cartes scannées arrivent dans une liste de scan, modifiable sur les deux appareils, puis entrent dans la collection quand on la valide. Le QR code reprend l'adresse ouverte sur l'ordinateur : ouverte sur `http://localhost:3000`, elle ne mène nulle part depuis le téléphone (la fenêtre du QR code le signale). De plus, l'application de développement n'écoute que sur `localhost`, et le navigateur du téléphone n'autorise la caméra qu'en HTTPS. Pour essayer le scan sur un vrai téléphone en local :

1. Exposez l'application par un tunnel HTTPS, par exemple `cloudflared tunnel --url http://localhost:3000` (l'adresse `https://….trycloudflare.com` change à chaque lancement).
2. Mettez cette adresse dans `BETTER_AUTH_URL` (fichier `.env`), puis relancez `make dev` : l'adresse est aussi autorisée par le serveur de développement.
3. Sur l'ordinateur, ouvrez la collection depuis l'adresse du tunnel (et non `localhost`), connectez-vous, puis affichez le QR code.

Sans caméra, la page de scan permet toujours d'ajouter les cartes par leur nom.

### Connexion avec Google (facultative)

Le bouton « Continuer avec Google » n'apparaît que si des identifiants OAuth sont fournis :

1. Dans la [console Google Cloud](https://console.cloud.google.com/), créez un projet, puis ouvrez « API et services » → « Écran de consentement OAuth ». Choisissez « Externe » et renseignez le nom de l'application et votre email.
2. Dans « Identifiants » → « Créer des identifiants » → « ID client OAuth », choisissez le type « Application Web ».
3. Ajoutez l'URI de redirection autorisée `http://localhost:3000/api/auth/callback/google` (puis, en production, `https://votre-domaine/api/auth/callback/google`).
4. Copiez l'ID client et le code secret dans `.env` (`GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`), puis relancez `docker compose up`.

Sous Linux, macOS ou WSL, `make dev` fait la même chose, et `make help` liste toutes les commandes (voir plus bas).

Si le port 5432 est déjà pris (un PostgreSQL installé sur la machine, par exemple), copiez `.env.example` en `.env` et changez `DB_PORT`.

### Sous Windows

- **Pour essayer l'application**, la commande `docker compose up --build` ci-dessus suffit, dans PowerShell ou l'invite de commandes. `make` n'existe pas sous Windows : utilisez les équivalents `docker compose` du tableau plus bas.
- **Pour développer**, passez par WSL 2. Les fichiers stockés côté Windows et partagés avec Docker ralentissent fortement Next.js, et le rechargement automatique y fonctionne mal.
  1. Si besoin, installez Ubuntu dans WSL (PowerShell en administrateur) : `wsl --install -d Ubuntu`.
  2. Dans Docker Desktop : Settings → Resources → WSL integration, activez Ubuntu.
  3. Dans le terminal Ubuntu : `sudo apt update && sudo apt install -y make git`, puis clonez le dépôt dans votre dossier personnel (`~`, pas `/mnt/c/…`) et lancez `make dev`.

## Commandes

| Commande | Rôle |
|---|---|
| `make dev` | Lance l'application en développement |
| `make up` / `make down` | Démarre l'environnement en arrière-plan / l'arrête |
| `make logs` | Affiche les journaux des services |
| `make sync` | Importe toutes les cartes depuis Scryfall |
| `make seed` | Importe le jeu de test (172 cartes, sans réseau) |
| `make check` | Lint, vérification des types et tests unitaires |
| `make test-db` | Tests sur une vraie base PostgreSQL (recherche de cartes) |
| `make e2e` | Tests de bout en bout dans un navigateur (Playwright) |
| `make e2e-ci` | Tests de bout en bout sur les images de production |
| `make db-migrate` | Applique les migrations de la base de données |
| `make db-generate name=…` | Génère une migration à partir du schéma |
| `make db-psql` | Ouvre une console SQL |
| `make install` | Met à jour les dépendances et `pnpm-lock.yaml` |
| `make pnpm args="add …"` | Lance une commande pnpm, par exemple pour ajouter une dépendance |
| `make audit` | Cherche des vulnérabilités connues dans les dépendances |
| `make build` | Construit les images de production |
| `make reset` | Supprime les conteneurs et les volumes (efface la base locale) |

`make help` affiche la liste complète.

Sans `make` (par exemple sous Windows), les commandes les plus utiles s'écrivent directement avec `docker compose` :

| Avec `make` | Sans `make` |
|---|---|
| `make dev` | `docker compose up --build` |
| `make down` | `docker compose down` |
| `make sync` | `docker compose run --rm --build app pnpm cards:sync` |
| `make check` | `docker compose run --rm --no-deps --build app pnpm check` |
| `make e2e` | `docker compose --profile e2e run --rm e2e` |
| `make db-migrate` | `docker compose run --rm migrate` |
| `make pnpm args="add …"` | `docker compose run --rm --no-deps app pnpm add …` |
| `make reset` | `docker compose --profile e2e down --volumes` |

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, PostgreSQL 18 avec Drizzle ORM, Better Auth, dnd-kit, Vitest, Playwright et Biome. Les détails et les choix d'architecture sont dans [`docs/PLAN.md`](docs/PLAN.md).

## Structure

```
src/app/[locale]/   pages (une version par langue : /fr, /en)
src/app/api/        routes API
src/components/     composants d'interface
src/domain/         logique métier pure (cartes, règles Commander, decks…), testée
src/i18n/           configuration des langues
src/server/         code serveur : base de données, comptes, decks, emails, configuration
messages/           traductions (fr.json, en.json)
drizzle/            migrations SQL
scripts/            scripts d'exploitation (migrations, import des cartes…)
tests/db/           préparation des tests sur base réelle
tests/e2e/          tests de bout en bout
tests/fixtures/     jeu de cartes de test
docker/             scripts Docker
```

## Mentions légales

MTG Creator est un contenu de fan non officiel, autorisé par la [politique de Wizards of the Coast sur les contenus de fans](https://company.wizards.com/en/legal/fancontentpolicy). Il n'est ni approuvé ni soutenu par Wizards. Certains éléments utilisés sont la propriété de Wizards of the Coast. ©Wizards of the Coast LLC.

Données et images des cartes fournies par [Scryfall](https://scryfall.com).
