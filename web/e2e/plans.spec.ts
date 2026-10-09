import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

const plan = (name: string) => ({
  name,
  summary: "Bihar clinics convert best; focus on demo sign-ups.",
  goal: "traffic",
  dailyBudget: 400,
  targeting: {
    countries: ["IN"],
    regions: [],
    cities: [],
    ageMin: 28,
    ageMax: 55,
    genders: "all",
    interests: [],
  },
  creative: {
    primaryText: "Run your clinic from one app.",
    alternatives: ["Save 2 hours a day at the front desk."],
    headline: "Free demo clinic",
    linkUrl: "https://arogyasystem.com/",
    callToAction: "SIGN_UP",
  },
  reasons: {
    goal: "Website visits first.",
    audience: "Clinic owners.",
    budget: "Small test.",
    creative: "Time saved.",
  },
});

test("reviews a plan, runs it on an Instagram post, creates it paused and launches", async ({
  page,
}, info) => {
  await ensureMetaConnected(page.request);
  const name = `Boost post ${Date.now()}`;
  const created = await page.request.post("/api/v1/campaign-plans", { data: { plan: plan(name) } });
  expect(created.ok()).toBeTruthy();
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/campaigns/plans/${id}`);
  await expect(page.getByLabel("Campaign name")).toHaveValue(name);
  await expect(page.getByRole("button", { name: "Create in Meta (paused)" })).toBeDisabled();

  await page.getByRole("button", { name: "Choose image or post" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("tab", { name: "Instagram posts" }).click();
  await picker
    .getByRole("button", { name: /#clinic/ })
    .first()
    .click();
  await expect(page.getByText(/Using your existing/)).toContainText("Instagram post");
  await page.screenshot({ path: info.outputPath("plan-with-post.png"), fullPage: true });

  await page.getByRole("button", { name: "Create in Meta (paused)" }).dispatchEvent("click");
  await expect(page.getByText("Created in Meta and paused")).toBeVisible();
  await page.getByRole("button", { name: "Launch", exact: true }).dispatchEvent("click");
  await page.getByRole("dialog").getByRole("button", { name: "Launch now" }).dispatchEvent("click");
  await expect(page.getByText("This campaign is live")).toBeVisible();
});
