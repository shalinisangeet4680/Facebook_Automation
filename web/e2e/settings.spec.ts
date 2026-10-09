import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("updates the workspace name and budget guardrails", async ({ page }) => {
  await page.goto("/settings");
  const name = page.getByLabel("Workspace name");
  await expect(name).toBeVisible();
  await name.fill("Arogya Clinic Group");
  await page.getByLabel(/Daily limit per campaign/).fill("20000");
  await expect(page.getByText(/The most allowed is/)).toBeVisible();
  await page.getByLabel(/Daily limit per campaign/).fill("2500");
  await page.getByLabel(/Target cost per result/).fill("180");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Workspace name")).toHaveValue("Arogya Clinic Group");
  await expect(page.getByLabel(/Daily limit per campaign/)).toHaveValue("2500");
  await expect(page.getByRole("complementary").getByText("Arogya Clinic Group")).toBeVisible();
});
