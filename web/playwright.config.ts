import { defineConfig, devices } from "@playwright/test";

const local = !process.env.CI;
const baseURL =
  process.env.E2E_BASE_URL ?? (local ? "http://localhost:3400" : "http://localhost:3200");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"]],
  use: {
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
    extraHTTPHeaders: { "X-Client": "web" },
  },
  webServer: local
    ? [
        {
          command: "bash scripts/e2e-backend.sh",
          url: "http://localhost:4100/health",
          reuseExistingServer: true,
          timeout: 180_000,
        },
        {
          command: "npm run build && npx next start -p 3400",
          url: "http://localhost:3400/login",
          env: { BACKEND_URL: "http://localhost:4100" },
          reuseExistingServer: true,
          timeout: 300_000,
        },
      ]
    : undefined,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome" },
      testMatch: /journey/,
    },
  ],
});
