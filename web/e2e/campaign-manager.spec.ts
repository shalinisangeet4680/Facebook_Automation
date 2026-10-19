import { expect, test, type APIRequestContext } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

const LEADS = "120210000000000001";
const DIWALI = "120210000000000003";
const LEADS_NAME = "Clinic owners – Free demo – Bihar";

async function relaxGuardrails(request: APIRequestContext) {
  const current = await request.get("/api/v1/settings");
  const settings = (await current.json()) as {
    workspace: { name: string };
    budget: { targetCostPerResult: number | null };
  };
  const res = await request.put("/api/v1/settings/workspace", {
    data: {
      name: settings.workspace.name,
      maxDailyBudget: 5000,
      monthlyBudget: null,
      targetCostPerResult: settings.budget.targetCostPerResult,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.beforeEach(async ({ page }) => {
  await ensureMetaConnected(page.request);
  await relaxGuardrails(page.request);
  await page.request.post(`/api/v1/ads/campaigns/${LEADS}/status`, {
    data: { status: "ACTIVE" },
  });
});

test("pauses and resumes a live campaign from the list, then opens it", async ({ page }, info) => {
  await page.goto("/campaigns");
  await expect(page.getByRole("tab", { name: "Live campaigns" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("link", { name: "New campaign" }).first()).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(LEADS_NAME) });
  const toggle = row.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: info.outputPath("live-campaigns.png"), fullPage: true });

  await toggle.click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText(`Pause “${LEADS_NAME}”?`);
  await expect(confirm).toContainText("It stops spending right away.");
  await confirm.getByRole("button", { name: "Pause campaign" }).click();
  await expect(page.getByText(`Paused “${LEADS_NAME}”`)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.getByRole("tab", { name: "Paused" }).click();
  await expect(page).toHaveURL(/status=paused/);
  await expect(page.getByRole("row", { name: new RegExp(LEADS_NAME) })).toBeVisible();
  await page.getByRole("tab", { name: "All" }).click();

  await toggle.click();
  await page.getByRole("dialog").getByRole("button", { name: "Turn on campaign" }).click();
  await expect(page.getByText(`Turned on “${LEADS_NAME}”`)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await page.getByRole("tab", { name: "Plans" }).click();
  await expect(page).toHaveURL(/tab=plans/);
  await expect(page.getByRole("heading", { name: "Or plan it with Claude" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New campaign" }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Live campaigns" }).click();

  await page.getByRole("link", { name: LEADS_NAME }).click();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${LEADS}$`));
  await expect(page.getByRole("heading", { name: LEADS_NAME })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open in Ads Manager/ })).toHaveAttribute(
    "href",
    new RegExp(`selected_campaign_ids=${LEADS}`),
  );
});

test("edits an ad set budget with inline checks and a confirmation", async ({ page }, info) => {
  await page.goto(`/campaigns/${LEADS}`);
  await page.getByRole("button", { name: /Edit budget of Doctors/ }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel(/Daily budget/);
  const current = await input.inputValue();
  const next = current === "900" ? "1000" : "900";

  await input.fill("0");
  await dialog.getByRole("button", { name: "Review change" }).click();
  await expect(dialog.getByText("Enter an amount above 0.")).toBeVisible();
  await input.fill("99999");
  await expect(dialog.getByText(/Your limit is ₹5,000 a day/)).toBeVisible();

  await input.fill(next);
  await dialog.getByRole("button", { name: "Review change" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText("Change the budget of “Doctors");
  await expect(confirm).toContainText(`to ₹${Number(next).toLocaleString("en-IN")} a day`);
  await page.screenshot({ path: info.outputPath("budget-confirm.png") });
  await confirm.getByRole("button", { name: "Change budget" }).click();
  await expect(
    page.getByText(`Budget set to ₹${Number(next).toLocaleString("en-IN")} a day`),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Doctors/ })).toContainText(
    `₹${Number(next).toLocaleString("en-IN")}/day`,
  );
});

test("edits an ad's text and keeps post-based ads read-only", async ({ page }, info) => {
  await page.goto(`/campaigns/${LEADS}`);
  await page.getByRole("button", { name: /Edit ad Queue chaos/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit ad" })).toBeVisible();

  await dialog.getByRole("button", { name: "Change image" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Choose an image" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Edit ad" })).toBeVisible();

  const edit = page.getByRole("dialog");
  await edit.getByLabel("Link").fill("not a link");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByText(/Enter the full web address/)).toBeVisible();

  const headline = `Free demo clinic ${Date.now() % 10_000}`;
  await edit.getByLabel("Link").fill("https://arogyasystem.com/demo");
  await edit.getByLabel("Headline").fill(headline);
  await edit.getByLabel("Button").selectOption("SIGN_UP");
  await page.screenshot({ path: info.outputPath("edit-ad.png") });
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Ad updated/)).toBeVisible();
  await expect(page.getByText(headline)).toBeVisible();

  await page.goto(`/campaigns/${DIWALI}`);
  await expect(page.getByRole("button", { name: /Edit budget of Diwali leads/ })).toBeVisible();
  await expect(page.getByText("Created from a post; edit it on Facebook/Instagram.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit ad Boosted post/ })).toHaveCount(0);
});
