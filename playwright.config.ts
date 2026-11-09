import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const BASE_URL = `http://localhost:${PORT}${BASE_PATH}/`;

/** Runs against the static export — the same files that get published. */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && node scripts/serve-static.mjs out ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
