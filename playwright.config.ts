import { defineConfig, devices } from "@playwright/test";

// L'application tourne à part (service Docker `app`) : Playwright ne la
// démarre pas lui-même. Adresse surchargée par E2E_BASE_URL dans Docker.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Permet d'utiliser un Chromium déjà installé hors de l'image Playwright.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
