import { expect, test, type Page } from "@playwright/test";

import { openTokenForm, signInWithGoogle } from "./fixtures";

async function freshUser(page: Page, name: string) {
  await signInWithGoogle(page, `${name}-${Date.now()}@treevook.test`);
  await expect(page).toHaveURL(/\/setup$/);
}

test("connects Meta Ads with Continue with Facebook", async ({ page }) => {
  await freshUser(page, "meta-oauth");

  await test.step("offers Facebook first and keeps the token as an advanced option", async () => {
    await page.goto("/setup/connect-meta");
    await expect(page.getByRole("heading", { name: "Connect your Meta business" })).toBeVisible();
    await expect(
      page.getByText(
        "You’ll pick your ad account, Page, Instagram and Pixel in Facebook’s window.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("System user access token")).toHaveCount(0);
    await openTokenForm(page);
    await expect(page.getByLabel("System user access token")).toBeVisible();
  });

  await test.step("explains a cancelled Facebook sign-in", async () => {
    await page.goto("/api/v1/meta/oauth/callback?error=access_denied&error_reason=user_denied");
    await expect(page).toHaveURL(/\/setup\/connect-meta/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Facebook sign-in was cancelled." }),
    ).toBeVisible();
  });

  await test.step("signs in with Facebook and continues the guided setup", async () => {
    await page.goto("/setup/start");
    await expect(
      page.getByRole("heading", { level: 2, name: "Connect your Meta business" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue with Facebook" }).click();
    await expect(page).toHaveURL(/\/setup\/start/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Choose your accounts" }),
    ).toBeVisible();
  });

  await test.step("shows how Meta was connected", async () => {
    await page.goto("/setup/connect-meta");
    await expect(page.getByRole("heading", { name: "Meta is connected" })).toBeVisible();
    await expect(page.getByText(/Connected with Facebook/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible();
  });
});
