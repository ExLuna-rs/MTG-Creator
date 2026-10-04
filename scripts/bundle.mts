// Regroupe chaque script d'exploitation et ses dépendances en un seul fichier,
// pour que l'image Docker « tools » n'embarque pas tout node_modules :
// node scripts/bundle.mts (pnpm build:scripts)
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/migrate.mts", "scripts/sync-cards.mts"],
  outdir: "dist/scripts",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  // Dépendance facultative de pg, jamais utilisée ici.
  external: ["pg-native"],
  // pg est en CommonJS et appelle require() : on le fournit au bundle ESM.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
