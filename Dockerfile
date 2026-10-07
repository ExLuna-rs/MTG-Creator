# syntax=docker/dockerfile:1

# Image de base : Node.js LTS sur Alpine, épinglée par empreinte et répétée
# dans chaque FROM pour que Dependabot puisse la mettre à jour.

# Les étapes qui téléchargent des paquets acceptent un secret facultatif
# « extra_ca » : certificat racine à ajouter pour construire derrière un proxy
# qui inspecte le HTTPS (proxy d'entreprise, par exemple) :
#   docker build --secret id=extra_ca,src=ca.crt .

# -----------------------------------------------------------------------------
# base : Node.js et pnpm (version lue dans le champ packageManager)
# -----------------------------------------------------------------------------
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS base
ENV COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
    && corepack enable pnpm \
    && corepack install \
    && chmod -R a+rX "$COREPACK_HOME"

# -----------------------------------------------------------------------------
# dev : développement, le code est monté depuis la machine hôte (compose.yaml)
# -----------------------------------------------------------------------------
FROM base AS dev
# Le magasin pnpm vit dans le volume node_modules : installations rapides.
# HOME=/tmp : les caches restent inscriptibles quel que soit l'utilisateur.
ENV npm_config_store_dir=/app/node_modules/.pnpm-store \
    HOME=/tmp
# compose lance ces conteneurs avec l'UID de la machine hôte : les volumes
# doivent être inscriptibles par n'importe quel utilisateur.
RUN mkdir -p /app/node_modules /app/.next \
    && chmod 777 /app/node_modules /app/.next
COPY --chmod=755 docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["dev-entrypoint"]
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]

# -----------------------------------------------------------------------------
# deps : toutes les dépendances, pour le build
# -----------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
    && pnpm install --frozen-lockfile --store-dir /pnpm/store

# -----------------------------------------------------------------------------
# build : application Next.js (sortie « standalone ») et scripts regroupés
# -----------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm build:scripts

# -----------------------------------------------------------------------------
# runner : image de production de l'application
# -----------------------------------------------------------------------------
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS runner
# npm, npx, corepack et yarn ne servent pas à l'exécution : retirés pour
# réduire la surface d'attaque et le bruit des analyses de vulnérabilités.
# Les paquets Alpine sont mis à jour : une faille corrigée entre deux versions
# de l'image Node.js (zlib, par exemple) n'attend pas Dependabot.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/extra_ca > /tmp/ca.pem \
      && export SSL_CERT_FILE=/tmp/ca.pem; \
    fi \
    && apk upgrade --no-cache \
    && rm -f /tmp/ca.pem \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Le code appartient à root (lecture seule pour l'application) ;
# seul le dossier .next, où Next.js écrit son cache, appartient à « node ».
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone/package.json /app/.next/standalone/server.js ./
COPY --from=build /app/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/standalone/.next ./.next
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]

# -----------------------------------------------------------------------------
# tools : scripts d'exploitation (migrations, puis synchronisation des cartes)
# -----------------------------------------------------------------------------
# Chaque script est un fichier autonome (pnpm build:scripts) : pas de node_modules.
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS tools
# npm, npx, corepack et yarn ne servent pas à l'exécution : retirés pour
# réduire la surface d'attaque et le bruit des analyses de vulnérabilités.
# Les paquets Alpine sont mis à jour : une faille corrigée entre deux versions
# de l'image Node.js (zlib, par exemple) n'attend pas Dependabot.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/extra_ca > /tmp/ca.pem \
      && export SSL_CERT_FILE=/tmp/ca.pem; \
    fi \
    && apk upgrade --no-cache \
    && rm -f /tmp/ca.pem \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/scripts ./scripts
COPY drizzle ./drizzle
USER node
CMD ["node", "scripts/migrate.mjs"]
