import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("shows suggestions from a check and applies one", async ({ page }, info) => {
  await ensureMetaConnected(page.request);
  await page.request.put("/api/v1/settings/workspace", {
    data: {
      name: "Arogya Clinic Group",
      maxDailyBudget: 5000,
      monthlyBudget: null,
      targetCostPerResult: 300,
    },
  });
  await page.goto("/setup");
  await page.getByRole("button", { name: "Check now" }).click();
  const heading = page.getByRole("heading", { level: 3, name: /more budget/ });
  await expect(heading).toBeVisible();
  const apply = page.getByRole("button", { name: /^Set budget to ₹[\d,]+$/ });
  const target = (await apply.textContent())!.replace("Set budget to ", "");
  await expect(page.getByText(`by 20% (to ${target})`)).toBeVisible();
  await page.screenshot({ path: info.outputPath("inbox.png"), fullPage: true });
  await apply.click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await expect(heading).toHaveCount(0);
});
