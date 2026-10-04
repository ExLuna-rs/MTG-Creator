import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lève une erreur hors du serveur React : neutralisé en test.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        // Tests sur une vraie base PostgreSQL (pnpm test:db, make test-db) :
        // une base jetable est créée, migrée et remplie du jeu de test.
        extends: true,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["tests/db/global-setup.ts"],
          setupFiles: ["tests/db/setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
