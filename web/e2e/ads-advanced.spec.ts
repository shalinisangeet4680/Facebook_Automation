import { expect, test, type APIRequestContext } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected, signInWithGoogle } from "./fixtures";

const MULTI_ACCOUNT_TOKEN = `EAA${"e".repeat(40)}multiaccount`;

const targeting = {
  countries: [],
  regions: [{ key: "1730", name: "Bihar" }],
  cities: [],
  ageMin: 28,
  ageMax: 55,
  genders: "all",
  interests: [{ id: "6003107902433", name: "Physician" }],
  workPositions: [],
  industries: [],
  behaviors: [],
};

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

test.describe("with the shared workspace", () => {
  test.use({ storageState: STORAGE_STATE });

  test.beforeEach(async ({ page }) => {
    await ensureMetaConnected(page.request);
    await relaxGuardrails(page.request);
  });

  test("tests versions of an ad and compares them side by side", async ({ page }, info) => {
    const generated = await page.request.post("/api/v1/campaign-plans/generate", {
      data: {
        goal: "traffic",
        dailyBudget: 500,
        locations: { regions: [{ key: "1730", name: "Bihar" }] },
        offer: "Free 30-day trial of our clinic app",
        landingUrl: "https://arogyasystem.com/demo",
        creative: { imageUrl: "https://arogyasystem.com/og.png" },
      },
    });
    expect(generated.ok(), await generated.text()).toBeTruthy();
    const { id } = (await generated.json()) as { id: string };

    await page.goto(`/campaigns/plans/${id}`);
    await expect(page.getByRole("heading", { name: "Versions to test" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Test version B" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      page.getByText("3 ads will be created in the same ad set, all paused."),
    ).toBeVisible();
    await page.getByRole("switch", { name: "Test version C" }).click();
    await expect(
      page.getByText("2 ads will be created in the same ad set, all paused."),
    ).toBeVisible();
    await page.getByLabel("Headline, version B").fill("Paperless in a week");
    await page.screenshot({ path: info.outputPath("versions.png"), fullPage: true });

    await page.getByRole("button", { name: "Create in Meta (paused)" }).dispatchEvent("click");
    await expect(page.getByText("Created in Meta and paused")).toBeVisible();
    await expect(page.getByText(/2 versions/)).toBeVisible();

    await page.getByRole("link", { name: "View results" }).click();
    await expect(page).toHaveURL(/\/campaigns\/\d+$/);
    await expect(page.getByText("Comparing 2 versions side by side.")).toBeVisible();
    await expect(page.getByText(/Not enough data yet/)).toBeVisible();
    await expect(page.getByText("Paperless in a week")).toBeVisible();
  });

  test("runs a video ad and keeps the video when its text is edited", async ({ page }) => {
    const proposed = await page.request.post("/api/v1/campaign-plans", {
      data: {
        plan: {
          name: `Clinic tour video ${Date.now()}`,
          summary: "A short video of the app.",
          goal: "traffic",
          dailyBudget: 400,
          targeting,
          creative: {
            primaryText: "See a paperless clinic in 30 seconds.",
            headline: "Free clinic demo",
            linkUrl: "https://arogyasystem.com/",
            videoUrl: "https://arogyasystem.com/media/clinic-tour.mp4",
            callToAction: "LEARN_MORE",
          },
          reasons: {
            goal: "Website visits.",
            audience: "Clinic owners.",
            budget: "Small test.",
            creative: "Video tour.",
          },
        },
      },
    });
    expect(proposed.ok(), await proposed.text()).toBeTruthy();
    const { id } = (await proposed.json()) as { id: string };

    await page.goto(`/campaigns/plans/${id}`);
    await expect(page.getByText(/Using a video from your library/)).toBeVisible();
    await expect(page.getByLabel("Ad video")).toBeVisible();
    await page.getByRole("button", { name: "Create in Meta (paused)" }).dispatchEvent("click");
    await expect(page.getByText("Created in Meta and paused")).toBeVisible();

    await page.getByRole("link", { name: "View results" }).click();
    await expect(page.getByText("Video", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Edit ad / }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Text edits keep the same video.")).toBeVisible();
    await dialog.getByLabel("Primary text").fill("A paperless clinic in 30 seconds.");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Ad updated/)).toBeVisible();
    await expect(page.getByText("A paperless clinic in 30 seconds.")).toBeVisible();
  });

  test("builds a campaign from a saved audience and saves a new one", async ({ page }) => {
    const name = `Bihar doctors ${Date.now()}`;
    const saved = await page.request.post("/api/v1/ads/audiences", {
      data: { name, targeting },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();

    await page.goto("/campaigns/new");
    await page.getByRole("radio", { name: /Get known nearby/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel(/Daily budget/).fill("500");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Use a saved audience").selectOption({ label: name });
    await expect(page.getByText("Using your saved audience")).toBeVisible();
    await expect(page.getByText("Bihar", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("What do you want to promote?").fill("Free clinic software demo");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("switch", { name: "Test 3 versions of your ad" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Generate plan" }).click();

    await expect(page).toHaveURL(/\/campaigns\/plans\/[0-9a-f-]+$/, { timeout: 30_000 });
    await expect(page.getByText(/Interest: Physician/)).toBeVisible();

    await page.getByRole("button", { name: "Save this audience" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Audience name").fill(`${name} copy`);
    await dialog.getByRole("button", { name: "Save audience" }).click();
    await expect(page.getByText(`Saved “${name} copy”`)).toBeVisible();
  });
});

test.describe("with several ad accounts", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("switches the active ad account from the sidebar", async ({ page }, info) => {
    await signInWithGoogle(page, `ads-accounts-${Date.now()}@treevook.test`);
    await expect(page).toHaveURL(/\/setup/);
    const connected = await page.request.post("/api/v1/meta/connection", {
      data: { token: MULTI_ACCOUNT_TOKEN },
    });
    expect(connected.ok(), await connected.text()).toBeTruthy();
    const selected = await page.request.put("/api/v1/meta/assets/selection", {
      data: {
        adAccountId: "act_1201000000000001",
        pageId: "1301000000000001",
        datasetId: "2519233968487265",
      },
    });
    expect(selected.ok(), await selected.text()).toBeTruthy();

    await page.goto("/campaigns");
    await expect(
      page.getByRole("row", { name: /Clinic owners – Free demo – Bihar/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ad account: Arogya System Ads. Switch ad account" })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /Arogya Clinics Delhi/ }).click();
    await expect(page.getByText("Switched to Arogya Clinics Delhi")).toBeVisible();
    await expect(page.getByRole("row", { name: /Clinics – Website visits – Delhi/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Clinic owners – Free demo – Bihar/ })).toHaveCount(
      0,
    );
    await page.screenshot({ path: info.outputPath("switched-account.png"), fullPage: true });

    await page.goto("/setup");
    await expect(
      page
        .getByRole("button", { name: "Ad account: Arogya Clinics Delhi. Switch ad account" })
        .first(),
    ).toContainText("USD");
  });
});
