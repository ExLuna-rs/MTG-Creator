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
| `make check` | Lint, vérification des types et tests unitaires |
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
| `make check` | `docker compose run --rm --no-deps --build app pnpm check` |
| `make e2e` | `docker compose --profile e2e run --rm e2e` |
| `make db-migrate` | `docker compose run --rm migrate` |
| `make pnpm args="add …"` | `docker compose run --rm --no-deps app pnpm add …` |
| `make reset` | `docker compose --profile e2e down --volumes` |

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, PostgreSQL 18 avec Drizzle ORM, Vitest, Playwright et Biome. Les détails et les choix d'architecture sont dans [`docs/PLAN.md`](docs/PLAN.md).

## Structure

```
src/app/[locale]/   pages (une version par langue : /fr, /en)
src/app/api/        routes API
src/components/     composants d'interface
src/i18n/           configuration des langues
src/server/         code serveur : base de données, configuration
messages/           traductions (fr.json, en.json)
drizzle/            migrations SQL
scripts/            scripts d'exploitation (migrations…)
tests/e2e/          tests de bout en bout
docker/             scripts Docker
```

## Mentions légales

MTG Creator est un contenu de fan non officiel, autorisé par la [politique de Wizards of the Coast sur les contenus de fans](https://company.wizards.com/en/legal/fancontentpolicy). Il n'est ni approuvé ni soutenu par Wizards. Certains éléments utilisés sont la propriété de Wizards of the Coast. ©Wizards of the Coast LLC.

Données et images des cartes fournies par [Scryfall](https://scryfall.com).
