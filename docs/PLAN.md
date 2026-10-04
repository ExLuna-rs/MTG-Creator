# MTG Creator — Plan du projet

Application web de création de decks *Magic: The Gathering* centrée sur le format **Commander**, bilingue **français / anglais**, avec **comptes utilisateurs** et decks sauvegardés en ligne.

> Document de référence du projet, mis à jour à la fin de chaque phase.

## 1. Décisions de départ

| Sujet | Décision |
|---|---|
| Sauvegarde | Comptes utilisateurs, decks stockés côté serveur dès la première version |
| Format de jeu | Commander (EDH) en priorité ; le modèle de données reste ouvert aux autres formats |
| Stack | React + TypeScript avec Next.js (front et back dans un seul projet) |
| Langues | Interface FR/EN avec sélecteur de langue ; cartes affichées en français ou en anglais ; recherche dans les deux langues |

## 2. Fonctionnalités

### Version 1 (MVP)

1. **Comptes** : inscription et connexion (email + mot de passe, puis Discord et Google), profil, suppression du compte.
2. **Base de cartes** : recherche par nom français ou anglais, tolérante aux accents et aux fautes de frappe ; filtres (couleurs, types, valeur de mana, texte, rareté, Game Changer…) ; fiche détaillée de chaque carte.
3. **Création d'un deck Commander** : choix du commandant, puis du partenaire ou du Background si la carte le permet.
4. **Éditeur de deck** :
   - recherche automatiquement limitée à l'identité couleur du commandant ;
   - ajout et retrait de cartes, glisser-déposer entre les groupes ;
   - regroupement par type de carte ou par catégorie personnalisée (Rampe, Pioche, Interaction…) ;
   - liste de cartes « à considérer » (maybeboard) ;
   - sauvegarde automatique, annuler / rétablir.
5. **Validation en temps réel** : 100 cartes exactement, un seul exemplaire par carte, identité couleur, cartes bannies, éligibilité du commandant, nombre de Game Changers.
6. **Statistiques** : courbe de mana, couleurs demandées comparées aux sources de mana, répartition par type, valeur de mana moyenne, nombre de terrains, prix total en EUR (Cardmarket) ou USD (TCGplayer).
7. **Import / export** au format texte (compatible Moxfield, Archidekt et MTG Arena). L'export utilise toujours les noms anglais pour rester compatible avec les autres outils.
8. **Partage** : deck privé, non listé (accessible par lien) ou public ; page publique en lecture seule ; bouton « Copier ce deck ».

### Version 2 : outils Commander avancés

- Estimation du **bracket** (1 à 5) : Game Changers, destruction massive de terrains, tours supplémentaires, combos.
- **Objectifs par catégorie** (par exemple 10 rampes, 10 pioches, 36 terrains) et suggestion automatique de catégorie à partir du texte des cartes.
- **Test de main** : main de départ, mulligan, pioche des tours suivants.
- **Choix de l'édition** de chaque carte (illustration, prix de cette édition).
- **Suggestions** : cartes populaires dans l'identité couleur du deck (rang EDHREC fourni par Scryfall).

### Plus tard

- Gestion de collection (cartes possédées, cartes manquantes et leur coût).
- Historique des versions d'un deck.
- Détection de combos (API de Commander Spellbook).
- Profils publics, likes, commentaires.
- Autres formats (Standard, Modern, Limité…), syntaxe de recherche avancée façon Scryfall, mode hors ligne.

## 3. Architecture

```
┌──────────────────────────── Navigateur ────────────────────────────┐
│  React (pages /fr/… et /en/…)                                      │
│  Images des cartes chargées depuis le CDN Scryfall                 │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ Server Components, Server Actions, routes API
┌─────────────────▼───────────────── Next.js ────────────────────────┐
│  Better Auth (sessions, OAuth)                                     │
│  Domaine : règles Commander, statistiques, import / export         │
│  Drizzle ORM                                                       │
└─────────────────┬──────────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────── PostgreSQL ──────────────────────┐
│  Utilisateurs, decks, copie locale des cartes Scryfall             │
└─────────────────▲──────────────────────────────────────────────────┘
                  │ chaque nuit
     GitHub Actions : synchronisation des données Scryfall
```

### Stack technique

| Couche | Choix | Rôle |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | Front et back dans le même projet ; rendu serveur des pages publiques |
| Interface | Tailwind CSS 4, shadcn/ui, icônes lucide | Composants accessibles et personnalisables |
| Symboles | mana-font ; icônes d'éditions SVG de Scryfall | Symboles de mana sans appel réseau |
| Traductions | next-intl | URLs `/fr/…` et `/en/…`, textes traduits, formats de nombres et de dates |
| Base de données | PostgreSQL 16 avec `pg_trgm` | Recherche floue sur les noms FR et EN |
| Accès aux données | Drizzle ORM et drizzle-kit | Requêtes typées, migrations |
| Authentification | Better Auth | Email + mot de passe, Discord, Google |
| État côté client | TanStack Query, Zustand | Cache des recherches, état de l'éditeur |
| Glisser-déposer | dnd-kit | Déplacer les cartes entre groupes |
| Graphiques | Recharts | Courbe de mana, répartitions |
| Validation | Zod | Contrôle des entrées et de l'import |
| Tests | Vitest, Testing Library, Playwright | Tests unitaires, de composants et de bout en bout |
| Intégration continue | GitHub Actions | Lint, types, tests et build à chaque pull request |
| Hébergement | Vercel + Neon (PostgreSQL managé) | Gratuit pour démarrer ; alternative : VPS avec Docker Compose |

### Données des cartes

Les cartes viennent de **Scryfall**, la référence des données Magic. Plutôt que d'appeler son API à chaque recherche, l'application garde une **copie locale** dans PostgreSQL, mise à jour chaque nuit. Cela permet :

- la recherche en français, insensible aux accents (« precepteur » trouve « Précepteur démoniaque ») ;
- la validation des decks côté serveur, sans appel externe ;
- de ne pas dépendre des limites de l'API Scryfall (10 requêtes par seconde au maximum, en-têtes `User-Agent` et `Accept` obligatoires).

| Source Scryfall | Contenu utilisé |
|---|---|
| Fichier *Oracle Cards* | Une entrée par carte : texte Oracle anglais, légalités, identité couleur, rang EDHREC, statut Game Changer |
| Fichier *Default Cards* | Toutes les éditions : images, prix, numéro de collection |
| Impressions françaises | Nom, type et texte imprimés en français (`printed_name`, `printed_type_line`, `printed_text`) |

Pour les données françaises, deux options seront comparées au début de la phase 1 : lire en flux le fichier *All Cards* (plusieurs Go) en ne gardant que le français, ou interroger la recherche Scryfall `lang:fr` page par page.

Les images sont affichées directement depuis le CDN de Scryfall, sans recadrage, pour que le nom de l'artiste et le copyright restent visibles. Quand une carte n'a pas de traduction française, elle s'affiche en anglais avec un indicateur.

### Modèle de données (simplifié)

| Table | Contenu |
|---|---|
| `user`, `session`, `account`, `verification` | Tables gérées par Better Auth |
| `card` | Une ligne par carte : `oracle_id`, noms EN et FR (plus leurs versions sans accents pour la recherche), coût, valeur de mana, types, textes, couleurs, identité couleur (masque de bits WUBRG), mots-clés, légalités, faces, mana produit, rang EDHREC, Game Changer, éligibilité comme commandant, édition par défaut |
| `printing` | Une ligne par édition : identifiant Scryfall, `oracle_id`, édition, numéro, rareté, images, prix, date de sortie |
| `deck` | Propriétaire, nom, description, format, visibilité (privé / non listé / public), illustration de couverture, dates |
| `deck_card` | Deck, carte (`oracle_id`), édition choisie (facultative), quantité, zone (commandant / deck / à considérer), catégories |

Les decks référencent les cartes par `oracle_id`, un identifiant stable qui ne change pas quand Scryfall met ses données à jour.

### Moteur de règles Commander

Code TypeScript pur dans `src/domain/commander`, indépendant de Next.js et couvert par des tests unitaires. Il vérifie :

- **Taille** : exactement 100 cartes, commandant(s) compris.
- **Commandant** : créature légendaire, Véhicule ou vaisseau (Spacecraft) légendaire possédant une force et une endurance (autorisé depuis *Edge of Eternities*, 2025), ou carte qui indique pouvoir être votre commandant.
- **Paires de commandants** : Partner et ses variantes, Partner with, Friends forever, Choose a Background avec un Background, Doctor's companion avec un Docteur.
- **Identité couleur** : l'identité de chaque carte doit être incluse dans celle du ou des commandants.
- **Singleton** : un seul exemplaire par carte, sauf les terrains de base et les cartes qui l'autorisent (« A deck can have any number of cards named… », « up to seven… »).
- **Légalité** : cartes bannies en Commander d'après Scryfall.
- **Game Changers et brackets** : la liste des Game Changers vient des données Scryfall (`is:gamechanger`), jamais codée en dur. Les règles des brackets (aucun Game Changer en brackets 1 et 2, 3 au maximum en bracket 3, sans limite en 4 et 5) sont dans un fichier de configuration versionné, car Wizards les fait évoluer.

### Organisation du code

```
src/
  app/[locale]/            pages (accueil, cartes, decks, compte)
  app/api/                 routes API (auth, recherche, autocomplétion)
  components/              composants UI (cartes, deck, symboles de mana)
  domain/                  logique métier pure et testée
    commander/             règles, éligibilité, identité couleur, brackets
    deck/                  statistiques, regroupements
    import-export/         lecture et écriture des listes texte
  server/                  base de données, requêtes, actions, auth
  i18n/                    configuration next-intl
messages/                  fr.json, en.json
scripts/                   synchronisation Scryfall
drizzle/                   migrations SQL
tests/e2e/                 tests Playwright
docs/                      ce plan et la documentation
```

## 4. Écrans

| Page | URL | Contenu |
|---|---|---|
| Accueil | `/fr` | Présentation, decks publics récents, bouton « Créer un deck » |
| Recherche de cartes | `/fr/cards` | Barre de recherche FR/EN, filtres, grille d'images |
| Fiche carte | `/fr/cards/[id]` | Image, textes FR et EN, légalités, éditions, prix |
| Mes decks | `/fr/decks` | Liste avec commandant, couleurs, nombre de cartes, prix, statut de validation |
| Nouveau deck | `/fr/decks/new` | Choix du commandant (et du partenaire) |
| Éditeur | `/fr/decks/[id]/edit` | Sur ordinateur : recherche à gauche, deck au centre, statistiques et validation à droite. Sur mobile : onglets |
| Deck (lecture) | `/fr/decks/[id]` | Liste, statistiques, export, « Copier ce deck » |
| Explorer | `/fr/explore` | Decks publics, filtrables par commandant et par couleurs |
| Compte | `/fr/settings` | Pseudo, langue, connexions, suppression du compte |

Toutes les pages existent aussi en anglais sous `/en/…`.

## 5. Feuille de route

Chaque phase se fait sur sa propre branche et se termine par une pull request relue avant la fusion.

### Phase 0 : fondations

- Projet Next.js + TypeScript + Tailwind + shadcn/ui, gestionnaire de paquets pnpm.
- Lint, formatage, Vitest, Playwright.
- PostgreSQL en local via Docker Compose, Drizzle et première migration.
- next-intl avec les routes `/fr` et `/en`, sélecteur de langue.
- Mise en page de base : en-tête, pied de page avec les mentions légales.
- CI GitHub Actions ; `CLAUDE.md` (conventions du projet) et script de démarrage pour les prochaines sessions Claude Code.

**Terminé quand** : l'application démarre en local en FR et en EN, et la CI passe.

### Phase 1 : base de cartes

- Script de synchronisation Scryfall (cartes, éditions, textes français).
- Recherche : autocomplétion par nom FR ou EN tolérante aux fautes, filtres, tri (popularité, nom, valeur de mana, prix).
- Page de recherche et fiche carte, symboles de mana, cartes recto verso.
- Jeu de données réduit (quelques centaines de cartes) versionné pour les tests.

**Terminé quand** : une carte se retrouve par son nom anglais ou par son nom français tapé sans accents, et les filtres de couleur et de type fonctionnent.

### Phase 2 : comptes

- Better Auth : inscription, connexion et déconnexion par email + mot de passe.
- Connexion Discord et Google, dès que les applications OAuth sont créées.
- Page Compte : pseudo, langue préférée, suppression du compte.
- Protection des pages et des actions réservées aux utilisateurs connectés.

**Terminé quand** : un utilisateur peut créer un compte, se reconnecter et supprimer son compte.

### Phase 3 : éditeur de deck Commander

- Création d'un deck à partir d'un commandant (et d'un partenaire ou Background).
- Éditeur complet : ajout, retrait, regroupements, catégories, cartes à considérer, sauvegarde automatique, annuler / rétablir.
- Moteur de règles Commander et panneau de validation.
- Statistiques : courbe de mana, couleurs, types, terrains, prix.
- Page « Mes decks ».

**Terminé quand** : on peut construire de bout en bout un deck de 100 cartes valide, et chaque règle a ses tests.

### Phase 4 : import, export, partage, puis mise en ligne du MVP

- Import texte : reconnaissance des noms anglais ou français, signalement des lignes non reconnues avec des suggestions.
- Export texte et format MTG Arena, copie dans le presse-papiers.
- Visibilité (privé / non listé / public), page publique avec aperçu pour les réseaux sociaux, « Copier ce deck », page Explorer.
- Déploiement en production (Vercel + Neon) et synchronisation nocturne des cartes.

**Terminé quand** : l'application est en ligne, et un deck exporté depuis Moxfield s'importe sans erreur.

### Phase 5 : outils Commander avancés (version 2)

Estimation du bracket, objectifs par catégorie, test de main, choix de l'édition, suggestions de cartes.

### Phase 6 et suivantes

Selon les priorités, dans la liste « Plus tard ».

## 6. Tests et qualité

- **Tests unitaires** (Vitest) sur tout le dossier `domain/` : règles Commander, statistiques, import / export. C'est là que les bugs coûtent le plus cher.
- **Tests d'intégration** sur les requêtes de recherche et la sauvegarde des decks, avec une vraie base PostgreSQL.
- **Tests de bout en bout** (Playwright) sur les parcours principaux : inscription → création d'un deck → ajout de cartes → validation → export.
- La CI exécute tous les tests à chaque pull request.

## 7. Aspects légaux et RGPD

- **Fan Content Policy de Wizards of the Coast** : l'application reste gratuite et affiche la mention « contenu de fan non officiel, non approuvé par Wizards of the Coast ».
- **Scryfall** : pas d'accès payant à ses données, attribution visible, aucune suggestion de partenariat ; les images ne sont jamais recadrées de façon à masquer l'artiste ou le copyright.
- **RGPD** : données personnelles minimales (email, pseudo), politique de confidentialité, suppression du compte et export des decks. Seuls des cookies de session sont utilisés, donc pas de bandeau cookies tant qu'aucun outil de mesure d'audience n'est ajouté.

## 8. Risques et points ouverts

| Risque | Réponse prévue |
|---|---|
| Fichier *All Cards* très volumineux (plusieurs Go) | Lecture en flux dans GitHub Actions, ou recherche `lang:fr` paginée ; choix au début de la phase 1 |
| Offre gratuite de Neon limitée à 0,5 Go | Ne garder que les champs utiles (estimation : 150 à 200 Mo pour les cartes) |
| Évolution des règles Commander (brackets, Game Changers, bannissements) | Données synchronisées chaque nuit, règles des brackets en configuration |
| Cartes sans traduction française | Affichage en anglais avec un indicateur |
| Le texte français de Scryfall est le texte imprimé, parfois antérieur aux errata Oracle | Texte Oracle anglais toujours accessible depuis la fiche carte |

## 9. Prérequis

1. **Avant la phase 1** : autoriser les domaines Scryfall dans les réglages réseau de l'environnement cloud (`api.scryfall.com`, `data.scryfall.io`, `cards.scryfall.io`), sans quoi les cartes ne peuvent pas être téléchargées depuis l'environnement de développement.
2. **Phase 2** : créer les applications OAuth Discord et Google, si ces modes de connexion sont retenus.
3. **Phase 4** : comptes Vercel et Neon pour la mise en ligne, et un service d'envoi d'emails (Resend par exemple) pour la vérification des adresses et la réinitialisation des mots de passe.
