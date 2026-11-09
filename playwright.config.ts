import { defineConfig, devices } from "@playwright/test";
// End-to-end test of the full MOCK flow (no funds, no network calls to 1-Click needed).
const PORT = Number(process.env.E2E_PORT ?? 3100);
export default defineConfig({
  testDir: "e2e", timeout: 60_000, retries: process.env.CI ? 1 : 0, reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure",
    ...(process.env.CHROME ? { launchOptions: { executablePath: process.env.CHROME, args: ["--no-sandbox"] } } : {}) },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npx next start -p ${PORT}`, port: PORT, reuseExistingServer: !process.env.CI, timeout: 120_000, env: { MOCK_1CLICK: "1", VERCEL: "1" } },
});
