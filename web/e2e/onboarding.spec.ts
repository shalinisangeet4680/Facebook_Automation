import { expect, test, type Page } from "@playwright/test";

import { VALID_TOKEN, signInWithGoogle } from "./fixtures";

const QUIET_TOKEN = `EAA${"e".repeat(40)}quietpixel`;

async function freshUser(page: Page, name: string) {
  await signInWithGoogle(page, `${name}-${Date.now()}@treevook.test`);
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByText("Get set up")).toBeVisible();
}

const stepTitle = (page: Page, name: string) =>
  expect(page.getByRole("heading", { level: 2, name })).toBeVisible();

async function fillBasics(page: Page) {
  await page.getByLabel("Website (optional)").fill("arogyasystem.com");
  await page
    .getByLabel("What do you sell?")
    .fill("Clinic management app for small clinics and doctors");
  await page.getByLabel("Main city or area").fill("Patna");
  await page.getByLabel("Type of business").fill("Software or app");
  await page.getByLabel("Language for your ads").selectOption("Hinglish");
  await page.getByRole("button", { name: "Save and continue" }).click();
}

async function fillGoal(page: Page) {
  await page.getByRole("radio", { name: /Get enquiries/ }).click();
  await page.getByLabel(/Comfortable daily budget/).fill("800");
  await page.getByLabel(/Monthly cap/).fill("20000");
  await page.getByLabel(/Target cost per result/).fill("150");
  await page.getByRole("button", { name: "Save and continue" }).click();
}

test("guides a new owner from connecting Meta to the first campaign", async ({ page }, info) => {
  await freshUser(page, "onboarding");

  await test.step("shows the real steps on the overview", async () => {
    await expect(page.getByText("0/7")).toBeVisible();
    await expect(page.getByText("Business basics")).toBeVisible();
    await page.getByRole("link", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/setup\/start\?step=connect_meta$/);
    await stepTitle(page, "Connect your Meta business");
    await expect(page.getByText("Step 1 of 7")).toBeVisible();
  });

  await test.step("connects Meta and comes back into the flow", async () => {
    await page.getByRole("link", { name: "Connect Meta" }).click();
    await expect(page).toHaveURL(/\/setup\/connect-meta$/);
    await page.getByLabel("System user access token").fill(VALID_TOKEN);
    await page.getByRole("button", { name: "Connect and verify" }).click();
    await expect(page.getByRole("heading", { name: "Meta is connected" })).toBeVisible();
    await page.getByRole("link", { name: "Continue setup" }).click();
    await expect(page).toHaveURL(/\/setup\/start/);
    await stepTitle(page, "Tell us about your business");
  });

  await test.step("saves the business basics", async () => {
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByText("Tell us in a line what you sell.")).toBeVisible();
    await fillBasics(page);
    await stepTitle(page, "Your goal and budget");
  });

  await test.step("saves the goal and budget into the guardrails", async () => {
    await page.getByRole("radio", { name: /Get enquiries/ }).click();
    await page.getByLabel(/Comfortable daily budget/).fill("800");
    await page.getByLabel(/Monthly cap/).fill("500");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByText("The monthly cap should be at least your daily budget."),
    ).toBeVisible();
    await fillGoal(page);
    await stepTitle(page, "Check your tracking");
  });

  await test.step("passes the tracking check for leads", async () => {
    await expect(page.getByText("Tracking is ready")).toBeVisible();
    await expect(page.getByText("Working", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Events Manager/ })).toBeVisible();
    await page.screenshot({ path: info.outputPath("setup-tracking.png"), fullPage: true });
    await page.getByRole("button", { name: "Next" }).click();
    await stepTitle(page, "Build your first campaign");
  });

  await test.step("opens the builder with the saved answers", async () => {
    await page.getByRole("link", { name: "Build my first campaign" }).click();
    await expect(page).toHaveURL(/\/campaigns\/new$/);
    await expect(page.getByRole("radio", { name: /Get enquiries/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel(/Daily budget/)).toHaveValue("800");
  });

  await test.step("shows progress and tracking on the overview", async () => {
    await page.goto("/setup");
    await expect(page.getByText("5/7")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tracking" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/setup/start?step=campaign_plan",
    );
  });
});

test("warns about a quiet Pixel and lets the owner skip the check", async ({ page }) => {
  await freshUser(page, "onboarding-quiet");
  await page.request.post("/api/v1/meta/connection", { data: { token: QUIET_TOKEN } });

  await page.goto("/setup/start");
  await stepTitle(page, "Tell us about your business");
  await fillBasics(page);
  await fillGoal(page);
  await stepTitle(page, "Check your tracking");

  await expect(page.getByText("Needs a look", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not ready for enquiries yet/)).toBeVisible();
  await expect(page.getByText(/thank-you page/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.goto("/campaigns/new");
  await expect(page.getByText("Your Pixel isn’t ready for this goal yet")).toBeVisible();

  await page.goto("/setup/start");
  await stepTitle(page, "Check your tracking");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await stepTitle(page, "Build your first campaign");
  await page.goto("/setup");
  await expect(page.getByText("· skipped")).toBeVisible();
});

test("fits the guided setup on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshUser(page, "onboarding-phone");
  await page.goto("/setup/start");
  await stepTitle(page, "Connect your Meta business");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});
