import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("shows KPIs, daily charts and campaigns, and switches periods", async ({ page }, info) => {
  await ensureMetaConnected(page.request);
  await page.goto("/reports");
  await expect(page.getByText("Cost per result")).toBeVisible();
  await expect(page.getByRole("img", { name: "Spend per day" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Clinic owners/ })).toBeVisible();
  await page.getByRole("img", { name: "Spend per day" }).hover({ position: { x: 120, y: 80 } });
  await page.screenshot({ path: info.outputPath("reports.png"), fullPage: true });
  await page.getByRole("radio", { name: "30 days" }).click();
  await expect(page.getByRole("radio", { name: "30 days" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("img", { name: "Results per day" })).toBeVisible();
});
