#!/bin/sh
# Point d'entrée des conteneurs de développement : met les dépendances à jour
# (quasi instantané quand rien n'a changé), puis lance la commande demandée.
# SKIP_INSTALL=1 saute cette étape (utilisé par `make install`).
set -eu

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  pnpm install --frozen-lockfile --prefer-offline
fi

exec "$@"
