# MTG Creator — Plan du projet

Application web de création de decks *Magic: The Gathering* centrée sur le format **Commander**, avec une interface **bilingue français / anglais**, des **comptes utilisateurs** et decks sauvegardés en ligne. **Tout tourne dans Docker**, du développement à la production.

> Document de référence du projet, mis à jour à la fin de chaque phase.

## 1. Décisions de départ

| Sujet | Décision |
|---|---|
| Sauvegarde | Comptes utilisateurs, decks stockés côté serveur dès la première version |
| Format de jeu | Commander (EDH) en priorité ; le modèle de données reste ouvert aux autres formats |
| Stack | React + TypeScript avec Next.js (front et back dans un seul projet) |
| Langues | Interface FR/EN avec sélecteur de langue ; cartes en anglais (noms et textes Oracle) dans un premier temps, cartes en français plus tard |
| Conteneurs | Tout tourne dans Docker : développement, tests, synchronisation des cartes et production |

## 2. Fonctionnalités

### Version 1 (MVP)

1. **Comptes** : inscription et connexion (email + mot de passe, puis Discord et Google), profil, suppression du compte.
2. **Base de cartes** : recherche par nom (anglais), tolérante aux accents et aux fautes de frappe ; filtres (couleurs, types, valeur de mana, texte, rareté, Game Changer…) ; fiche détaillée de chaque carte.
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

- Cartes en français : noms, types et textes imprimés, recherche par nom français.
- Gestion de collection (cartes possédées, cartes manquantes et leur coût).
- Historique des versions d'un deck.
- Détection de combos (API de Commander Spellbook).
- Profils publics, likes, commentaires.
- Autres formats (Standard, Modern, Limité…), syntaxe de recherche avancée façon Scryfall, mode hors ligne.

## 3. Architecture

```
Navigateur (React, pages /fr/… et /en/…)
  │                          └──► images des cartes : CDN Scryfall
  │ HTTPS
  ▼
Cloudflare : DNS, HTTPS, CDN, protection DDoS, pare-feu applicatif (WAF)
  │ tunnel chiffré, ouvert depuis le serveur (aucun port ouvert sur Internet)
  ▼
Docker Compose, sur un VPS
  ├─ cloudflared  connecteur du tunnel Cloudflare (prod)
  ├─ app          Next.js : pages, API, comptes, règles Commander, statistiques
  ├─ db           PostgreSQL : utilisateurs, decks, copie locale des cartes
  ├─ migrate      applique les migrations de la base avant le démarrage de app
  ├─ sync         synchronisation des cartes Scryfall (chaque nuit en prod)
  ├─ backup       sauvegarde quotidienne de la base vers Cloudflare R2 (prod)
  └─ mailpit      boîte mail de test (dev)
```

### Stack technique

| Couche | Choix | Rôle |
|---|---|---|
| Framework | Next.js 16 (16.3.8 au minimum, voir la section Sécurité), React 19.3, TypeScript strict | Front et back dans le même projet ; rendu serveur des pages publiques |
| Interface | Tailwind CSS 4, shadcn/ui, icônes lucide | Composants accessibles et personnalisables |
| Symboles | mana-font ; icônes d'éditions SVG de Scryfall | Symboles de mana sans appel réseau |
| Traductions | next-intl | URLs `/fr/…` et `/en/…`, textes traduits, formats de nombres et de dates |
| Base de données | PostgreSQL avec `pg_trgm` | Recherche floue sur les noms des cartes |
| Accès aux données | Drizzle ORM et drizzle-kit | Requêtes typées, migrations |
| Authentification | Better Auth | Email + mot de passe, Discord, Google |
| État côté client | TanStack Query, Zustand | Cache des recherches, état de l'éditeur |
| Glisser-déposer | dnd-kit | Déplacer les cartes entre groupes |
| Graphiques | Recharts | Courbe de mana, répartitions |
| Validation | Zod | Contrôle des entrées et de l'import |
| Tests | Vitest, Testing Library, Playwright | Tests unitaires, de composants et de bout en bout |
| Conteneurs | Docker, Docker Compose | Mêmes services en développement, en test et en production |
| Emails | Mailpit en développement ; fournisseur SMTP en production (Brevo, Resend…) | Vérification des adresses, mot de passe oublié |
| Intégration continue | GitHub Actions | Tests dans Docker, image publiée sur GitHub Container Registry |
| Hébergement | VPS (OVHcloud, Scaleway, Hetzner…) avec Docker Compose | Quelques euros par mois, données dans l'UE, mêmes services qu'en développement |
| Exposition | Cloudflare (offre gratuite) : Tunnel, DNS, CDN, WAF | HTTPS sans certificat à gérer, serveur sans aucun port ouvert, protection contre les attaques |
| Sauvegardes | Cloudflare R2 (10 Go gratuits) | Copie quotidienne de la base hors du serveur |

### Environnement Docker

| Service | Développement | Production |
|---|---|---|
| `app` | Rechargement à chaud du code | Image optimisée (`output: "standalone"`), utilisateur non root, contrôle de santé |
| `db` | PostgreSQL avec volume local | PostgreSQL avec volume persistant, non exposé sur Internet |
| `migrate` | Lancé avant `app` | Lancé à chaque déploiement, avant `app` |
| `sync` | À la demande (`make sync`) | Chaque nuit |
| `mailpit` | Interface web pour lire les emails envoyés par l'application | — |
| `cloudflared` | — | Tunnel vers Cloudflare : le trafic arrive sans qu'aucun port soit ouvert sur le serveur |
| `backup` | — | Sauvegarde quotidienne de la base avec rotation, envoyée sur Cloudflare R2 |

Fichiers :

- `Dockerfile` multi-étapes : installation des dépendances, build, puis image d'exécution légère.
- `compose.yaml` pour le développement, `compose.prod.yaml` pour la production.
- `.env.example` documente toutes les variables ; les vrais fichiers `.env` ne sont jamais commités.
- `Makefile` avec des raccourcis : `make dev`, `make test`, `make e2e`, `make sync`, `make db-migrate`.

Il suffit d'avoir Docker sur sa machine : pas besoin d'installer Node.js ni PostgreSQL. Les tests tournent aussi dans des conteneurs : tests unitaires et d'intégration dans `app` avec la base `db`, tests de bout en bout dans l'image officielle de Playwright.

En production, la CI construit l'image et la publie sur GitHub Container Registry. Le serveur se contente de la télécharger et de redémarrer les services (`docker compose pull` puis `docker compose up -d`), ce qui permet de garder un petit serveur : le build de Next.js consomme beaucoup de mémoire.

### Données des cartes

Les cartes viennent de **Scryfall**, la référence des données Magic. Plutôt que d'appeler son API à chaque recherche, l'application garde une **copie locale** dans PostgreSQL, mise à jour chaque nuit par le service `sync`. Cela permet :

- une recherche rapide et tolérante (« jotun » trouve « Jötun Grunt », « sol rign » trouve « Sol Ring ») ;
- la validation des decks côté serveur, sans appel externe ;
- de ne pas dépendre des limites de l'API Scryfall (10 requêtes par seconde au maximum, en-têtes `User-Agent` et `Accept` obligatoires).

| Source Scryfall | Contenu utilisé |
|---|---|
| Fichier *Oracle Cards* (≈ 25 Mo compressés) | Une entrée par carte : texte Oracle anglais, légalités, identité couleur, rang EDHREC, statut Game Changer, image et prix de l'édition par défaut |
| Fichier *Default Cards* (phase 5) | Toutes les éditions : images, prix, numéro de collection |

Scryfall publie ces fichiers au format JSONL compressé, lus en flux par le service `sync`. Les jetons, emblèmes, plans, cartes « Art Series » et cartes uniquement numériques non légales en Commander ne sont pas importés. Les noms et textes français viendront plus tard (voir « Plus tard »).

Les images sont affichées directement depuis le CDN de Scryfall, sans recadrage, pour que le nom de l'artiste et le copyright restent visibles.

La recherche par nom compare la saisie à une version normalisée du nom (minuscules, sans accents ni ponctuation, colonne `search_name`) grâce à l'extension `pg_trgm` : une carte est retenue si son nom contient la saisie ou lui ressemble assez. Les résultats sont classés ainsi : nom exact, nom dont un mot commence par la saisie, nom qui la contient, simple ressemblance ; à égalité, la carte la plus jouée (rang EDHREC) passe devant. Les symboles de mana utilisent la police libre Mana (paquet `mana-font`).

### Modèle de données (simplifié)

| Table | Contenu |
|---|---|
| `user`, `session`, `account`, `verification` | Tables gérées par Better Auth |
| `card` | Une ligne par carte : `oracle_id`, nom (et sa version normalisée, sans accents, pour la recherche), coût, valeur de mana, types, textes, couleurs, identité couleur (masque de bits WUBRG), mots-clés, légalités, faces, mana produit, rang EDHREC, Game Changer, éligibilité comme commandant, édition par défaut |
| `printing` (phase 5) | Une ligne par édition : identifiant Scryfall, `oracle_id`, édition, numéro, rareté, images, prix, date de sortie |
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
docker/                    scripts Docker (démarrage, sauvegardes)
docs/                      ce plan et la documentation
Dockerfile                 image de l'application
compose.yaml               services de développement
compose.prod.yaml          services de production
Makefile                   raccourcis (make dev, make test…)
```

## 4. Écrans

| Page | URL | Contenu |
|---|---|---|
| Accueil | `/fr` | Présentation, decks publics récents, bouton « Créer un deck » |
| Recherche de cartes | `/fr/cards` | Barre de recherche, filtres, grille d'images |
| Fiche carte | `/fr/cards/[id]` | Image (recto verso), texte Oracle, légalités, prix |
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
- Docker : `Dockerfile` multi-étapes, `compose.yaml` (app avec rechargement à chaud, PostgreSQL, Mailpit), `Makefile`.
- Lint, formatage, Vitest et Playwright, exécutés dans les conteneurs.
- Drizzle, première migration et service `migrate`.
- next-intl avec les routes `/fr` et `/en`, sélecteur de langue.
- Mise en page de base : en-tête, pied de page avec les mentions légales.
- CI GitHub Actions (tests dans Docker, construction de l'image) ; `CLAUDE.md` (conventions du projet) et script de démarrage pour les prochaines sessions Claude Code.
- Sécurité : Dependabot, audit des dépendances et analyse de l'image dans la CI, actions GitHub épinglées par empreinte de commit.

**Terminé quand** : sur une machine qui n'a que Docker, `make dev` lance l'application en FR et en EN, et la CI passe.

**État** : terminée (pull request n° 1).

### Phase 1 : base de cartes

- Service `sync` : import des cartes Scryfall (fichier *Oracle Cards*).
- Recherche : autocomplétion par nom tolérante aux fautes, filtres, tri (popularité, nom, valeur de mana, prix).
- Page de recherche et fiche carte, symboles de mana, cartes recto verso.
- Jeu de données réduit (quelques centaines de cartes) versionné pour les tests.

**Terminé quand** : une carte se retrouve par son nom, même tapé sans accents ou avec une faute de frappe (« jotun » trouve « Jötun Grunt »), et les filtres de couleur et de type fonctionnent.

**État** : terminée (pull request n° 2).

- Import : `make sync` télécharge le fichier *Oracle Cards* (≈ 33 900 cartes gardées, environ 30 secondes) ; `make seed` importe le jeu de test (172 cartes, sans réseau), utilisé par les tests sur base réelle et les tests de bout en bout. La synchronisation nocturne arrive avec la mise en production (phase 4).
- Recherche (`/fr/cards`) : nom avec suggestions au clavier et à la souris, identité couleur, types, valeur de mana, rareté, texte, légalité en Commander, commandants possibles, Game Changers ; tri par pertinence, popularité, nom, valeur de mana ou prix ; 60 cartes par page. Le formulaire fonctionne aussi sans JavaScript.
- Fiche carte (`/fr/cards/[id]`) : images recto verso, texte Oracle avec symboles de mana, légalités dans douze formats, prix Cardmarket et TCGplayer, rang EDHREC, lien vers Scryfall.

### Phase 2 : comptes

- Better Auth : inscription, connexion et déconnexion par email + mot de passe.
- Vérification de l'adresse email et mot de passe oublié (emails visibles dans Mailpit en développement).
- Connexion Discord et Google, dès que les applications OAuth sont créées.
- Page Compte : pseudo, langue préférée, suppression du compte.
- Protection des pages et des actions réservées aux utilisateurs connectés.

**Terminé quand** : un utilisateur peut créer un compte, confirmer son email, réinitialiser son mot de passe, se reconnecter et supprimer son compte.

### Phase 3 : éditeur de deck Commander

- Création d'un deck à partir d'un commandant (et d'un partenaire ou Background).
- Éditeur complet : ajout, retrait, regroupements, catégories, cartes à considérer, sauvegarde automatique, annuler / rétablir.
- Moteur de règles Commander et panneau de validation.
- Statistiques : courbe de mana, couleurs, types, terrains, prix.
- Page « Mes decks ».

**Terminé quand** : on peut construire de bout en bout un deck de 100 cartes valide, et chaque règle a ses tests.

### Phase 4 : import, export, partage, puis mise en ligne du MVP

- Import texte : reconnaissance des noms des cartes, signalement des lignes non reconnues avec des suggestions.
- Export texte et format MTG Arena, copie dans le presse-papiers.
- Visibilité (privé / non listé / public), page publique avec aperçu pour les réseaux sociaux (illustration du commandant), « Copier ce deck », page Explorer.
- Mise en production sur un VPS : `compose.prod.yaml` (tunnel Cloudflare, sauvegardes sur R2, synchronisation nocturne), domaine et règles de sécurité Cloudflare, image publiée par la CI, déploiement automatique depuis `main`.

**Terminé quand** : l'application est en ligne en HTTPS, les sauvegardes tournent, et un deck exporté depuis Moxfield s'importe sans erreur.

### Phase 5 : outils Commander avancés (version 2)

Estimation du bracket, objectifs par catégorie, test de main, choix de l'édition (table `printing`), suggestions de cartes.

### Phase 6 et suivantes

Selon les priorités, dans la liste « Plus tard ».

### Chantier parallèle : scan de cartes depuis le téléphone

Objectif : scanner ses cartes physiques avec l'appareil photo du téléphone, comme l'application Manabox, mais directement dans l'application web, sans rien installer. Ce chantier avance à côté des phases : il ne décale pas la feuille de route, et chaque étape démarre dès que sa dépendance est terminée.

**Approche technique**

- **Caméra** : `navigator.mediaDevices.getUserMedia` avec la caméra arrière (`facingMode: "environment"`), affichée dans une page `/fr/scan` avec un cadre de visée à la taille d'une carte. Le navigateur exige HTTPS (fourni par Cloudflare en production, `localhost` en développement). L'en-tête `Permissions-Policy` de `next.config.ts` bloque aujourd'hui la caméra (`camera=()`) : il faudra l'autoriser pour le site lui-même (`camera=(self)`).
- **Reconnaissance du nom** : on ne garde que la bande du nom en haut de la carte, puis on la lit par reconnaissance de texte (OCR) dans le navigateur avec Tesseract.js (WebAssembly). L'image ne quitte pas le téléphone et le serveur n'a aucun calcul lourd à faire. Les fichiers de Tesseract (≈ 5 Mo) sont servis par l'application elle-même, chargés seulement sur la page de scan, et mis en cache.
- **Correspondance avec la base** : le texte lu, souvent imparfait, est envoyé à la recherche floue de la phase 1 (`pg_trgm` sur `search_name`), qui tolère déjà les fautes. Une carte est reconnue quand la meilleure correspondance est assez sûre ; sinon, l'utilisateur choisit parmi les trois premières propositions.
- **Édition exacte** (plus tard) : sur les cartes imprimées depuis 2014, le bas de la carte porte le code de l'édition et le numéro de collection ; les lire donne l'édition exacte, donc la bonne illustration et le bon prix (table `printing`).
- **Reconnaissance de l'illustration** (piste, si l'OCR ne suffit pas) : comparer une empreinte de l'image (hachage perceptuel) avec celles de toutes les éditions, précalculées par le service `sync`. C'est plus robuste (cartes abîmées, autres langues) mais demande de télécharger et traiter environ 100 000 images Scryfall : à étudier seulement si le besoin se confirme.

**Étapes et dépendances**

| Étape | Contenu | Dépend de |
|---|---|---|
| S1 : prototype | Page de scan, caméra, OCR du nom, fiche de la carte reconnue ; test sur plusieurs téléphones (Android et iPhone) | Phase 1 (terminée) : peut démarrer tout de suite |
| S2 : liste de scan | Scan en continu, liste des cartes scannées avec quantités, correction manuelle, export texte | S1 |
| S3 : ajout à un deck | Envoyer la liste scannée dans un deck ou dans les cartes à considérer | Phase 3 (éditeur de deck), comptes de la phase 2 |
| S4 : édition exacte | Lecture du code d'édition et du numéro de collection | Phase 5 (table `printing`) |
| S5 : collection | Ajouter les cartes scannées à sa collection | Gestion de collection (« Plus tard ») |

Les cartes en français ne seront reconnues qu'une fois les noms français importés (« Plus tard ») ; d'ici là, le scan vise les cartes en anglais.

**Tests** : la logique de nettoyage du texte lu et de choix de la correspondance va dans `src/domain/scan/` avec des tests unitaires sur des lectures OCR réelles enregistrées ; les tests de bout en bout utilisent la caméra simulée de Chromium (`--use-file-for-fake-video-capture`) avec la photo d'une carte.

**Terminé quand** (S1 et S2) : sur un téléphone, on scanne une dizaine de cartes anglaises à la suite, et au moins neuf sur dix sont reconnues sans correction.

## 6. Tests et qualité

- **Tests unitaires** (Vitest) sur tout le dossier `domain/` : règles Commander, statistiques, import / export. C'est là que les bugs coûtent le plus cher.
- **Tests d'intégration** sur les requêtes de recherche et la sauvegarde des decks, avec une vraie base PostgreSQL dans Docker.
- **Tests de bout en bout** (Playwright, dans son image Docker officielle) sur les parcours principaux : inscription → création d'un deck → ajout de cartes → validation → export.
- La CI exécute tous les tests dans Docker à chaque pull request.

## 7. Sécurité

### Versions

- **Next.js 16.3.8 au minimum** (publiée le 30 septembre 2026) : c'est la dernière version, et elle corrige toutes les failles connues à ce jour. Parmi elles, une exécution de code à distance dans `next/og` (corrigée en 16.3.6), qui touchait justement les serveurs Node.js auto-hébergés comme le nôtre. **React 19.3.0**. Au 4 octobre 2026, `npm audit` ne signale aucune vulnérabilité connue pour ces versions.
- Les versions exactes sont figées par le fichier de verrouillage `pnpm-lock.yaml`, et l'image Docker est construite à partir de ce fichier (`pnpm install --frozen-lockfile`).

### Mises à jour

Next.js a publié plusieurs correctifs de sécurité en 2026 (juillet, août, puis deux en septembre) : une version sûre aujourd'hui ne le sera plus forcément dans un mois. Le projet est donc organisé pour se mettre à jour vite :

- **Dependabot** ouvre automatiquement des pull requests pour les dépendances npm, les images Docker (Node.js, PostgreSQL, cloudflared) et les actions GitHub. Les alertes de sécurité GitHub sont activées.
- **La CI bloque la fusion** si `pnpm audit` trouve une faille haute ou critique, et elle analyse l'image Docker (Grype ou Docker Scout).
- **Les actions GitHub sont épinglées par empreinte de commit** et non par tag : en mars 2026, des tags de l'action Trivy ont été détournés pour voler des secrets de CI.
- Appliquer un correctif revient à fusionner la pull request de mise à jour : la CI reconstruit l'image et le serveur la redéploie.

### Dans le code

Le code reste prudent même si le framework a une faille :

- L'autorisation est vérifiée dans chaque Server Action, route API et fonction d'accès aux données, pas seulement dans le `proxy` (l'ancien middleware) : plusieurs failles de Next.js ont permis de contourner le middleware.
- Toutes les entrées sont validées avec Zod, les modules serveur sont protégés par `server-only`, et aucun secret ne passe par les variables `NEXT_PUBLIC_*`.
- L'optimiseur d'images de Next.js, qui a connu plusieurs failles, est désactivé : les images viennent directement du CDN Scryfall. Les aperçus pour les réseaux sociaux utilisent l'illustration du commandant fournie par Scryfall au lieu d'images générées avec `next/og`.
- Better Auth limite les tentatives de connexion, en lisant l'adresse IP réelle des visiteurs dans l'en-tête `CF-Connecting-IP` transmis par Cloudflare. Les cookies de session sont `HttpOnly`, `Secure` et `SameSite`.
- Next.js envoie les en-têtes de sécurité (CSP, HSTS, `frame-ancestors`, `Referrer-Policy`), et le pare-feu applicatif de Cloudflare filtre le trafic avant qu'il n'atteigne le serveur.

### Docker et serveur

- Image minimale, utilisateur non root, aucun outil de build dans l'image finale.
- Aucun port n'est ouvert sur Internet : le trafic web arrive par le tunnel Cloudflare, et PostgreSQL n'est joignable que depuis le réseau Docker interne.
- Les secrets sont dans des fichiers `.env` jamais commités.
- Sur le serveur : connexion SSH par clé uniquement, pare-feu, mises à jour de sécurité automatiques du système.

## 8. Aspects légaux et RGPD

- **Fan Content Policy de Wizards of the Coast** : l'application reste gratuite et affiche la mention « contenu de fan non officiel, non approuvé par Wizards of the Coast ».
- **Scryfall** : pas d'accès payant à ses données, attribution visible, aucune suggestion de partenariat ; les images ne sont jamais recadrées de façon à masquer l'artiste ou le copyright.
- **RGPD** : hébergement dans l'Union européenne, données personnelles minimales (email, pseudo), politique de confidentialité (qui cite Cloudflare comme sous-traitant), suppression du compte et export des decks. Seuls des cookies de session sont utilisés, donc pas de bandeau cookies tant qu'aucun outil de mesure d'audience n'est ajouté.

## 9. Risques et points ouverts

| Risque | Réponse prévue |
|---|---|
| Nouvelles failles dans Next.js ou dans d'autres dépendances | Pull requests Dependabot, audit bloquant dans la CI, redéploiement automatique après fusion |
| Serveur à maintenir soi-même | Sauvegardes quotidiennes sur R2, aucun port exposé grâce au tunnel, mises à jour régulières des images Docker |
| Dépendance à Cloudflare pour l'accès au site | L'application ne dépend pas de Cloudflare : le tunnel peut être remplacé par un reverse proxy classique (Caddy) en quelques lignes |
| Évolution des règles Commander (brackets, Game Changers, bannissements) | Données synchronisées chaque nuit, règles des brackets en configuration |

## 10. Prérequis

1. **Sur la machine de développement** : Docker Desktop (Windows, macOS) ou Docker Engine (Linux). Rien d'autre.
2. **Avant la phase 1** (fait) : autoriser les domaines Scryfall dans les réglages réseau de l'environnement cloud (`api.scryfall.com`, `data.scryfall.io`, `cards.scryfall.io`), sans quoi les cartes ne peuvent pas être téléchargées depuis l'environnement de développement.
3. **Phase 2** : créer les applications OAuth Discord et Google, si ces modes de connexion sont retenus.
4. **Phase 4** : un VPS (quelques euros par mois), un compte Cloudflare (offre gratuite) gérant le nom de domaine, et un fournisseur d'emails SMTP (Brevo, Resend…).
