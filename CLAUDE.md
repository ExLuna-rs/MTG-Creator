@AGENTS.md

# MTG Creator — consignes pour Claude Code

Application web de création de decks *Magic: The Gathering* (format Commander). L'interface est bilingue français / anglais ; les cartes sont en anglais pour l'instant, le français viendra plus tard. Le plan complet et la feuille de route sont dans `docs/PLAN.md` : le lire avant d'attaquer une phase, et le mettre à jour à la fin de chaque phase.

## Langues

- Échanges avec l'utilisateur, documentation, commentaires et messages de commit : en français.
- Identifiants du code (variables, fonctions, fichiers) : en anglais.
- Textes de l'interface : jamais en dur, toujours dans `messages/fr.json` et `messages/en.json`, avec les mêmes clés dans les deux fichiers (vérifié par un test).

## Tout passe par Docker

Seul Docker est requis. Commandes principales (`make help` pour la liste complète) :

| Commande | Rôle |
|---|---|
| `make dev` / `make up` | Environnement de développement (premier plan / arrière-plan) |
| `make check` | Lint (Biome), types (TypeScript) et tests unitaires (Vitest) |
| `make e2e` | Tests de bout en bout (Playwright) sur l'environnement de développement |
| `make e2e-ci` | Tests de bout en bout sur les images de production |
| `make db-generate name=…` / `make db-migrate` | Générer / appliquer une migration |
| `make audit` | Vulnérabilités connues des dépendances |

Sessions cloud : le hook `.claude/hooks/session-start.sh` démarre Docker et règle `COMPOSE`, `TEST_COMPOSE` et `DOCKER_BUILD` pour que les conteneurs passent par le proxy de la session. Utiliser les mêmes commandes `make`. `make scan` ne fonctionne qu'en CI (base de vulnérabilités de Grype inaccessible). Pour itérer vite, `pnpm lint` et `pnpm test` marchent aussi directement sur l'hôte ; la référence reste `make check`.

## Architecture

- `src/app/[locale]/` : pages ; `src/app/api/` : routes API.
- `src/domain/` : logique métier pure (règles Commander, statistiques, import / export), sans dépendance à Next.js, couverte par des tests unitaires.
- `src/server/` : code exclusivement serveur (`import "server-only"`) : base de données, comptes (Better Auth, `src/server/auth/`), emails, variables d'environnement.
- Pages réservées aux utilisateurs connectés : `requireSession()` (`src/server/auth/session.ts`) au début de la page ou de l'action, en plus de toute vérification d'appartenance des données.
- `src/i18n/` : configuration next-intl. Pour les liens et redirections, utiliser `@/i18n/navigation`, pas `next/link` ni `next/navigation`.
- Base de données : Drizzle ORM, schéma dans `src/server/db/schema.ts`. Les migrations sont générées par `make db-generate` et ne sont jamais modifiées une fois appliquées.
- Next.js 16 : `src/proxy.ts` remplace le middleware. Lire la documentation embarquée (`node_modules/next/dist/docs/`) avant d'utiliser une API de Next.js.

## Sécurité (règles non négociables)

- Vérifier l'autorisation dans chaque Server Action, route API et fonction d'accès aux données, jamais seulement dans `proxy.ts`.
- Valider toutes les entrées avec Zod.
- Aucun secret dans les variables `NEXT_PUBLIC_*` ni dans le dépôt (`.env` n'est jamais commité).
- Pas d'optimiseur d'images Next.js ni de `next/og` : les images des cartes viennent du CDN Scryfall.
- Images Docker épinglées par empreinte, actions GitHub par SHA de commit : Dependabot les met à jour.
- Next.js 16.3.8 au minimum ; `make audit` doit rester sans faille haute ou critique.

## Façon de travailler

- Une branche et une pull request par phase du plan. La CI doit être verte : lint, types, tests unitaires, audit, tests de bout en bout sur les images de production, analyse des images.
- Chaque fonctionnalité arrive avec ses tests : unitaires dans `src/**/*.test.ts`, de bout en bout dans `tests/e2e/`.
