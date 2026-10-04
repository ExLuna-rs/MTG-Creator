# Raccourcis pour travailler entièrement dans Docker : `make help` liste les commandes.
# Commandes surchargeables par l'environnement (voir .claude/hooks/session-start.sh).
COMPOSE ?= docker compose
TEST_COMPOSE ?= $(COMPOSE) -f compose.test.yaml
DOCKER_BUILD ?= docker build
# Les conteneurs de développement tournent avec votre utilisateur : les
# fichiers qu'ils créent dans le dépôt vous appartiennent.
export HOST_UID ?= $(shell id -u)
export HOST_GID ?= $(shell id -g)
# Lance une commande dans le conteneur de l'application, sans démarrer la base.
RUN := $(COMPOSE) run --rm --no-deps --build app

.DEFAULT_GOAL := help
.PHONY: help dev up down logs ps sh install pnpm lint format typecheck test check test-db \
	e2e e2e-ci db-migrate db-generate db-psql sync seed build audit scan clean reset

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
	    | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.env:
	cp .env.example .env

dev: .env ## Lance l'application en développement (http://localhost:3000)
	$(COMPOSE) up --build

up: .env ## Lance l'environnement de développement en arrière-plan
	$(COMPOSE) up --build --detach --wait

down: ## Arrête l'environnement de développement
	$(COMPOSE) down

logs: ## Affiche les journaux des services
	$(COMPOSE) logs --follow

ps: ## Liste les services et leur état
	$(COMPOSE) ps

sh: ## Ouvre un shell dans le conteneur de l'application
	$(RUN) sh

install: ## Installe les dépendances et met à jour pnpm-lock.yaml
	$(COMPOSE) run --rm --no-deps -e SKIP_INSTALL=1 app pnpm install

pnpm: ## Lance une commande pnpm dans le conteneur (exemple : make pnpm args="add zod")
	$(RUN) pnpm $(args)

lint: ## Vérifie le style et la qualité du code (Biome)
	$(RUN) pnpm lint

format: ## Corrige le formatage et les erreurs corrigeables automatiquement
	$(RUN) pnpm lint:fix

typecheck: ## Vérifie les types TypeScript
	$(RUN) pnpm typecheck

test: ## Lance les tests unitaires (Vitest)
	$(RUN) pnpm test

check: ## Lint, types et tests unitaires
	$(RUN) pnpm check

test-db: ## Lance les tests sur une vraie base PostgreSQL (base jetable)
	$(COMPOSE) run --rm --build app pnpm test:db

e2e: .env seed ## Lance les tests de bout en bout sur l'environnement de développement
	$(COMPOSE) --profile e2e run --rm e2e

e2e-ci: ## Lance les tests de bout en bout sur les images de production
	$(TEST_COMPOSE) up --build --detach --wait app \
	    || { $(TEST_COMPOSE) logs; $(TEST_COMPOSE) down --volumes; exit 1; }
	$(TEST_COMPOSE) run --rm e2e; status=$$?; $(TEST_COMPOSE) down --volumes; exit $$status

db-migrate: ## Applique les migrations de la base de données
	$(COMPOSE) run --rm migrate

sync: ## Importe toutes les cartes depuis Scryfall (environ 25 Mo, 30 s)
	$(COMPOSE) run --rm --build app pnpm cards:sync

seed: ## Importe le jeu de cartes de test (172 cartes, sans réseau)
	$(COMPOSE) run --rm --build app pnpm cards:seed

db-generate: ## Génère une migration depuis le schéma Drizzle (name=nom_facultatif)
	$(RUN) pnpm db:generate $(if $(name),--name=$(name),)

db-psql: ## Ouvre une console SQL sur la base de développement
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

build: ## Construit les images de production (application et outils)
	$(DOCKER_BUILD) --target runner --tag mtg-creator:local .
	$(DOCKER_BUILD) --target tools --tag mtg-creator-tools:local .

audit: ## Cherche des vulnérabilités connues dans les dépendances
	$(RUN) pnpm audit --audit-level high

scan: build ## Analyse les images de production avec Grype (failles hautes corrigeables)
	mkdir -p .scan
	docker save mtg-creator:local --output .scan/app.tar
	docker save mtg-creator-tools:local --output .scan/tools.tar
	$(TEST_COMPOSE) --profile scan run --rm grype docker-archive:/scan/app.tar --only-fixed --fail-on high
	$(TEST_COMPOSE) --profile scan run --rm grype docker-archive:/scan/tools.tar --only-fixed --fail-on high

clean: ## Supprime les résultats de tests de bout en bout
	$(COMPOSE) --profile e2e run --rm --no-deps --entrypoint "" e2e \
	    rm -rf test-results playwright-report blob-report

reset: ## Arrête tout et supprime les volumes (efface la base de développement)
	$(COMPOSE) --profile e2e down --volumes --remove-orphans
