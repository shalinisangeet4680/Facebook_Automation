import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("builds an instant form campaign with a lead form step", async ({ page }, info) => {
  await ensureMetaConnected(page.request);

  await page.goto("/campaigns/new");
  await page.getByRole("radio", { name: /Get leads on Facebook/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await page.getByLabel(/Daily budget/).fill("500");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("Add a city or state").fill("Pat");
  await page.getByRole("option", { name: /Patna/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("What do you want to promote?").fill("Free demo of our clinic app");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Lead form" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Full name" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Phone number" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Phone number" }).click();
  await page.getByLabel("Privacy policy link").fill("");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Ask for a phone number or an email/)).toBeVisible();
  await expect(page.getByText(/Add your privacy policy link/)).toBeVisible();
  await page.getByRole("button", { name: "Email" }).click();
  await page.getByLabel("Privacy policy link").fill("https://arogyasystem.com/privacy");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose an image/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("instant-form-step.png"), fullPage: true });
  await page.getByRole("button", { name: "Generate plan" }).click();

  await expect(page).toHaveURL(/\/campaigns\/plans\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Lead form" })).toBeVisible();
  await expect(page.getByLabel("Privacy policy link")).toHaveValue(
    "https://arogyasystem.com/privacy",
  );
  await expect(page.getByRole("radio", { name: /Instant form leads/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.screenshot({ path: info.outputPath("instant-form-review.png"), fullPage: true });
});

test("syncs, filters and follows up on leads", async ({ page }) => {
  await ensureMetaConnected(page.request);

  await page.goto("/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  const list = page.getByRole("list", { name: "Leads" });
  await expect(list.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
  await expect(list.locator('a[href^="tel:+91"]').first()).toBeVisible();

  const first = list.getByRole("listitem").first();
  await first.getByRole("combobox", { name: /Status for/ }).click();
  await page.getByRole("option", { name: "Contacted" }).click();
  await page.getByRole("tab", { name: "Contacted" }).click();
  await expect(page).toHaveURL(/status=contacted/);
  await expect(list.getByRole("listitem")).not.toHaveCount(0);

  await list
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: /Notes and details/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Notes").fill(`Called, wants a demo on Monday (${Date.now()})`);
  await dialog.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Notes saved")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.getByLabel("Search leads").fill("zzzz-nobody");
  await expect(page.getByText("No leads match")).toBeVisible();
});

test("shows a Leads item in the sidebar and fits a phone screen", async ({ page }) => {
  await ensureMetaConnected(page.request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/leads");
  await expect(page.getByRole("link", { name: /^Leads/ }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
