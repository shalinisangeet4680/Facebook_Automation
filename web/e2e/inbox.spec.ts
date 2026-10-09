import { expect, test } from "@playwright/test";

import { STORAGE_STATE, VALID_TOKEN } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("shows suggestions from a check and applies one", async ({ page }, info) => {
  await page.request.post("/api/v1/meta/connection", { data: { token: VALID_TOKEN } });
  await page.request.put("/api/v1/settings/workspace", {
    data: {
      name: "Arogya Clinic Group",
      maxDailyBudget: 5000,
      monthlyBudget: null,
      targetCostPerResult: 300,
    },
  });
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Check now" }).click();
  const heading = page.getByRole("heading", { level: 3, name: /more budget/ });
  await expect(heading).toBeVisible();
  await expect(page.getByText("₹960", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("inbox.png"), fullPage: true });
  await page.getByRole("button", { name: /Set budget to/ }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await expect(heading).toHaveCount(0);
});
