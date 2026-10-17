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

test("changes workspace AI drafting and Slack escalation for every product", async ({ page }) => {
  await page.request.put("/api/v1/automation/settings", {
    data: { aiMode: "platform", slackWebhook: null, slackChannel: null },
  });
  await page.goto("/settings#ai");
  await expect(page.getByRole("heading", { name: "AI & automation" })).toBeVisible();
  await expect(page.getByText(/AI drafts used in the last 24 hours/)).toBeVisible();
  await page.getByRole("radio", { name: /My Anthropic key/ }).click();
  await expect(page.getByText("AI drafting updated")).toBeVisible();
  await expect(page.getByLabel("Anthropic API key")).toBeVisible();
  await page.getByLabel("Incoming webhook URL").fill("https://hooks.slack.com/services/T0/B0/x");
  await page.getByLabel("Channel").fill("support");
  await page.getByRole("button", { name: "Save Slack" }).click();
  await expect(page.getByText("Slack saved")).toBeVisible();
  await expect(page.getByText(/Low ratings post to #support/)).toBeVisible();
  await page.getByRole("radio", { name: /TreeVook AI/ }).click();
  await expect(page.getByLabel("Anthropic API key")).toBeHidden();
  await page.request.put("/api/v1/automation/settings", {
    data: { slackWebhook: null, slackChannel: null },
  });
});
