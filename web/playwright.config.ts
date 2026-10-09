import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    channel: "chrome",
    trace: "retain-on-failure",
    extraHTTPHeaders: { "X-Client": "web" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome" },
      testMatch: /journey/,
    },
  ],
});
