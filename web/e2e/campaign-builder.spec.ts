import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

test("builds a campaign plan in the app and opens it for review", async ({ page }, info) => {
  await ensureMetaConnected(page.request);

  await page.goto("/campaigns");
  await page.getByRole("link", { name: "New campaign" }).first().click();
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await expect(page.getByRole("heading", { name: "New campaign" })).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Pick what you want from this campaign.")).toBeVisible();
  await page.getByRole("radio", { name: /Get website visits/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await page.getByLabel(/Daily budget/).fill("500");
  await expect(page.getByText("About a month")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Add at least one city or state.")).toBeVisible();
  await page.getByLabel("Add a city or state").fill("Pat");
  await page.getByRole("option", { name: /Patna/ }).click();
  await page.getByLabel("Youngest age").fill("25");
  await page.getByLabel("Oldest age").fill("55");
  await page.getByLabel(/Who are they/).fill("clinic owners and doctors interested in health care");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Tell us what you want to promote.")).toBeVisible();
  await expect(page.getByText(/This goal needs your website/)).toBeVisible();
  await page
    .getByLabel("What do you want to promote?")
    .fill("Free 30-day trial of our clinic management app");
  await page.getByLabel(/Web page to send people to/).fill("https://arogyasystem.com/demo");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 5 of 5")).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose an image, video or post/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("builder-last-step.png"), fullPage: true });
  await page.getByRole("button", { name: "Generate plan" }).click();

  await expect(page).toHaveURL(/\/campaigns\/plans\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByLabel("Campaign name")).toHaveValue(/Patna/);
  await expect(page.getByText("Created in TreeVook")).toBeVisible();
  await expect(page.getByText(/Interest: Health care/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("builder-review.png"), fullPage: true });
});

test("shows the builder at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/campaigns/new");
  await page.getByRole("radio", { name: /Get known nearby/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByLabel(/Daily budget/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
