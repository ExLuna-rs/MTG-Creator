#!/bin/bash
# Prépare les sessions cloud de Claude Code : démarre Docker, configure les
# commandes `make` pour le proxy HTTPS de la session et installe les
# dépendances (sur l'hôte et dans le volume Docker). Sans effet en local.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
LOG=/tmp/session-start.log
: >"$LOG"

# 1. Démon Docker, absent au démarrage des sessions cloud. `setsid` le
#    détache de ce script pour qu'il survive à la fin du hook.
if ! docker info >/dev/null 2>&1; then
  setsid -f dockerd >/tmp/dockerd.log 2>&1
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
docker info >/dev/null 2>&1 || { echo "Le démon Docker n'a pas démarré (voir /tmp/dockerd.log)." >&2; exit 1; }

# 2. Commandes `make` : surcharges compose et build passant par le proxy.
COMPOSE="docker compose -f compose.yaml -f .claude/docker/compose.cloud.yaml"
TEST_COMPOSE="docker compose -f compose.test.yaml -f .claude/docker/compose.test.cloud.yaml"
DOCKER_BUILD="docker build --network host --build-arg HTTPS_PROXY --secret id=extra_ca,src=/root/.ccr/ca-bundle.crt"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export COMPOSE=\"$COMPOSE\""
    echo "export TEST_COMPOSE=\"$TEST_COMPOSE\""
    echo "export DOCKER_BUILD=\"$DOCKER_BUILD\""
  } >>"$CLAUDE_ENV_FILE"
fi

# 3. Dépendances : sur l'hôte (itérations rapides avec pnpm) et dans le
#    volume node_modules du conteneur (l'entrypoint lance pnpm install).
{
  pnpm install --frozen-lockfile
  $COMPOSE build app
  $COMPOSE run --rm --no-deps app true
  $COMPOSE pull --quiet db mailpit
} >>"$LOG" 2>&1

echo "Docker est démarré et les dépendances sont installées (journal : $LOG)."
echo "Utilisez les commandes make (make check, make up, make e2e…) : elles passent par le proxy de la session."
