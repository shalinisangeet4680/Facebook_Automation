import { expect, test } from "@playwright/test";

import { CODE, JOURNEY_PHONES, NO_PERMS_TOKEN, VALID_TOKEN, goToCode } from "./fixtures";

test("signs in, connects Meta, chooses accounts and signs out", async ({ page }, testInfo) => {
  const phone = JOURNEY_PHONES[testInfo.project.name]!;

  await test.step("redirects to sign in and rejects a wrong code", async () => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login\?next=%2Fsetup/);
    await goToCode(page, phone);
    await page.getByLabel("Digit 1").fill("000000");
    await expect(page.getByText(/That code is incorrect/)).toBeVisible();
  });

  await test.step("signs in with the right code", async () => {
    await page.getByLabel("Digit 1").fill(CODE);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
    await page.request.delete("/api/v1/meta/connection");
    await page.reload();
    await expect(page.getByText("1 of 9 complete")).toBeVisible();
  });

  await test.step("explains missing permissions", async () => {
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/setup\/connect-meta$/);
    await page.getByLabel("System user access token").fill(NO_PERMS_TOKEN);
    await page.getByRole("button", { name: "Connect and verify" }).click();
    await expect(page.getByText("Missing required: ads_management.")).toBeVisible();
  });

  await test.step("connects with a valid token", async () => {
    await page.getByLabel("System user access token").fill(VALID_TOKEN);
    await page.getByRole("button", { name: "Connect and verify" }).click();
    await expect(page.getByRole("heading", { name: "Meta is connected" })).toBeVisible();
  });

  await test.step("saves accounts and returns to setup", async () => {
    await page.getByRole("link", { name: "Choose accounts" }).click();
    await expect(page.getByRole("heading", { name: "Choose your accounts" })).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByText("3 of 9 complete")).toBeVisible();
  });

  await test.step("disconnects Meta", async () => {
    await page.goto("/setup/connect-meta");
    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("heading", { name: "Connect your Meta business" })).toBeVisible();
  });

  await test.step("signs out", async () => {
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});
