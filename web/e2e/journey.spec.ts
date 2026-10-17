import { expect, test } from "@playwright/test";

import { JOURNEY_PHONES, NO_PERMS_TOKEN, VALID_TOKEN, signInWithGoogle } from "./fixtures";

test("signs in, connects Meta, chooses accounts and signs out", async ({ page }, testInfo) => {
  const phone = JOURNEY_PHONES[testInfo.project.name]!;

  await test.step("redirects to sign in and explains a cancelled Google sign-in", async () => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login\?next=%2Fsetup/);
    await page.goto("/login?error=Google+sign-in+was+cancelled.");
    await expect(page.getByText("Google sign-in was cancelled.")).toHaveAttribute("role", "alert");
  });

  await test.step("signs in with Google", async () => {
    await signInWithGoogle(page, `journey-${phone}@treevook.test`);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.request.delete("/api/v1/meta/connection");
    await page.reload();
    await expect(page.getByText("Get set up")).toBeVisible();
    await expect(page.getByText("0/3")).toBeVisible();
  });

  await test.step("explains missing permissions", async () => {
    await page.getByRole("link", { name: "Start" }).click();
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
    await expect(page.getByText("2/3")).toBeVisible();
  });

  await test.step("disconnects Meta", async () => {
    await page.goto("/setup/connect-meta");
    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("heading", { name: "Connect your Meta business" })).toBeVisible();
  });

  await test.step("signs out", async () => {
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});
