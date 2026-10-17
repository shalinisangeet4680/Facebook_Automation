import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures";

test.use({ storageState: STORAGE_STATE, reducedMotion: "reduce" });

const key = (email: string) => ({
  name: `${email.split("@")[0]}.json`,
  mimeType: "application/json",
  buffer: Buffer.from(
    JSON.stringify({
      type: "service_account",
      project_id: "pulse-studio",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n",
      client_email: email,
    }),
  ),
});

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

async function reset(page: Page) {
  const list = (await (await page.request.get("/api/v1/play/connections")).json()) as {
    data: { id: string }[];
  };
  for (const c of list.data) await page.request.delete(`/api/v1/play/connections/${c.id}`);
  await page.request.put("/api/v1/play/workspace", { data: { agentsCanPost: false } });
}

const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator(".rp-toast").filter({ hasText: text })).toBeVisible();

test.describe.configure({ mode: "serial" });

test("connects Google Play step by step and explains a bad key", async ({ page }, info) => {
  await reset(page);
  await page.goto("/reviews");
  await expect(page).toHaveURL(/\/reviews\/connect$/);
  await expect(page.getByRole("heading", { name: /Connect Google Play/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Templates" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await audit(page);

  await page.getByRole("button", { name: "Done, next step" }).click();
  await page.getByRole("button", { name: "Done, next step" }).click();
  const file = page.locator('input[type="file"]');
  await file.setInputFiles(key("revoked@pulse-studio.iam.gserviceaccount.com"));
  await expect(page.getByText("revoked@pulse-studio.iam.gserviceaccount.com")).toBeVisible();
  await page.getByRole("button", { name: "Verify & connect" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("This key can’t be read");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.getByRole("button", { name: "Remove key" }).click();
  await file.setInputFiles(key("noreporting@pulse-studio.iam.gserviceaccount.com"));
  await page.getByRole("button", { name: "Verify & connect" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Reporting API is turned off",
  );
  await expect(page.getByRole("link", { name: "Open Cloud Console ↗" })).toBeVisible();

  await page.getByRole("button", { name: "Remove key" }).click();
  await file.setInputFiles(key("discover@pulse-studio.iam.gserviceaccount.com"));
  await page.getByRole("button", { name: "Verify & connect" }).click();
  await toast(page, "Connected · 2 apps found");
  await expect(page).toHaveURL(/\/reviews$/, { timeout: 15_000 });
  await page.screenshot({ path: info.outputPath("connected.png") });
});

test("runs apps per rating and lists every app", async ({ page }, info) => {
  await page.goto("/reviews/apps");
  await expect(page.getByText(/2 connected · \d+ reviews? awaiting a reply/)).toBeVisible();
  const shop = page.getByRole("link", { name: /Discover Shop/ });
  await expect(shop).toContainText("Approval");
  await audit(page);

  await shop.getByRole("switch", { name: "Auto-reply for Discover Shop" }).click();
  await toast(page, "Discover Shop: auto-reply paused");
  await expect(shop.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await shop.getByRole("switch").click();
  await toast(page, "Discover Shop: auto-reply on");

  await shop.click();
  await expect(page.getByRole("heading", { name: "Discover Shop" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Reviews" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Needs reply/ })).toContainText("8");
  await expect(page.locator("article").first()).toContainText("Discover Shop");
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByRole("img", { name: "Reviews vs. replies · 30 days" })).toBeVisible();
  await expect(page.getByText("Rating by version")).toBeVisible();
  await audit(page);

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page).toHaveURL(/tab=settings/);
  const five = page.getByRole("radiogroup", { name: "Mode for 5-star reviews" });
  await five.getByRole("radio", { name: "Auto" }).click();
  await expect(five.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("combobox", { name: "Template for 1-star reviews" }).click();
  await page.getByRole("option", { name: "AI-written, no template" }).click();
  await page.getByRole("combobox", { name: "Posting delay" }).click();
  await page.getByRole("option", { name: "1 hour" }).click();
  await page.getByRole("switch", { name: "Escalate 1★ reviews" }).click();
  await page.getByRole("textbox", { name: "support_email" }).fill("help@discover.app");
  await page.getByRole("button", { name: "Save values" }).click();
  await toast(page, "Placeholder values saved");
  await page.reload();
  await expect(
    page
      .getByRole("radiogroup", { name: "Mode for 5-star reviews" })
      .getByRole("radio", { name: "Auto" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("combobox", { name: "Posting delay" })).toContainText("1 hour");
  await expect(page.getByRole("switch", { name: "Escalate 1★ reviews" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.goto("/reviews/apps");
  await expect(page.getByRole("link", { name: /Discover Shop/ })).toContainText("Mixed");
  await audit(page);
  await page.screenshot({ path: info.outputPath("apps.png") });
});

test("shows the dashboard, then approves, rewrites and skips an app's reviews", async ({
  page,
}, info) => {
  const connections = (await (await page.request.get("/api/v1/play/connections")).json()) as {
    data: { id: string }[];
  };
  const title = `Inbox Test ${Date.now()}`;
  const added = await page.request.post("/api/v1/play/apps", {
    data: {
      connectionId: connections.data[0]!.id,
      packageName: `com.e2e.inbox${Date.now()}`,
      title,
    },
  });
  expect(added.ok(), await added.text()).toBeTruthy();

  const { id: newAppId } = (await added.json()) as { id: string };
  await page.goto("/reviews");
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  await expect(page.getByText(/reviews? need a reply across/)).toBeVisible();
  await audit(page);
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/reviews/${newAppId}$`));
  await expect(page.getByRole("tab", { name: /Needs reply/ })).toContainText("8");
  const first = page.locator("article").first();
  const before = await first.getByRole("textbox").inputValue();
  await first.getByRole("button", { name: "Rewrite" }).click();
  await expect(page.locator("article").first().getByRole("textbox")).not.toHaveValue(before);

  await page.locator("article").first().getByRole("button", { name: "Approve & post" }).click();
  await toast(page, "Reply posted to Google Play");
  await page.locator("article").first().getByRole("button", { name: "Skip" }).click();
  await toast(page, "Skipped");
  await expect(page.getByRole("tab", { name: /Needs reply/ })).toContainText("6");

  await page.getByRole("tab", { name: /Replied/ }).click();
  await expect(page.getByText("Replied · You")).toBeVisible();
  await expect(page.getByText(/Skipped · by you/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("inbox-replied.png"), fullPage: true });

  await page.getByRole("tab", { name: /Needs reply/ }).click();
  await page.getByRole("button", { name: "Approve all 6" }).click();
  await toast(page, "6 replies posted");
  await expect(page.getByRole("heading", { name: /All caught up on/ })).toBeVisible();
  await audit(page);
});

test("duplicates a pre-built template and edits the copy", async ({ page }) => {
  await page.goto("/reviews/templates");
  await expect(page.getByText("Read-only")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue("Grateful thanks");
  await page.getByRole("button", { name: "{support_email}" }).click();
  await toast(page, "Duplicate to edit a pre-built template");
  await audit(page);

  await page.getByRole("button", { name: "Duplicate" }).click();
  await toast(page, "Duplicated — now editable");
  const name = page.getByRole("textbox", { name: "Template name" });
  await expect(name).toHaveValue("Grateful thanks copy");
  await name.fill("Warm thanks");
  await page.getByRole("button", { name: "4★", exact: true }).click();
  const body = page.getByRole("textbox", { name: "Template text" });
  await body.fill("Thanks ");
  await page.getByRole("button", { name: "{user_name}" }).click();
  await expect(page.getByText("Thanks Maya")).toBeVisible();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Warm thanks/ }).click();
  await expect(page.getByRole("textbox", { name: "Template text" })).toHaveValue(
    "Thanks {user_name}",
  );
  await page.getByRole("button", { name: "Delete" }).click();
  await toast(page, "Template deleted");
});

test("filters the dashboard by app and period, and shows MCP access", async ({ page }) => {
  await page.goto("/reviews");
  await expect(page.getByText("What reviewers talk about")).toBeVisible();
  await page.getByRole("button", { name: "30d" }).click();
  await expect(page.getByText("Reply rate · 30d")).toBeVisible();
  await expect(page.getByRole("img", { name: "Reviews vs. replies · 30 days" })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText("Reply rate · all time")).toBeVisible();
  await page.getByRole("button", { name: /Custom/ }).click();
  await page.getByRole("button", { name: "This year" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Reply rate · range")).toBeVisible();
  await expect(page.getByRole("button", { name: /Jan 1 – / })).toBeVisible();
  await page.getByRole("combobox", { name: "App" }).click();
  await page.getByRole("option", { name: "Discover Shop" }).click();
  await expect(page.getByRole("combobox", { name: "App" })).toContainText("Discover Shop");
  await expect(page.getByText(/on Discover Shop|Every review has a reply/)).toBeVisible();
  await audit(page);

  await page.goto("/reviews/mcp");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByText(/rk_live_[0-9a-f]{36}/).first()).toBeVisible();
  await expect(page.getByText("Agents can only draft")).toBeVisible();
  await page.getByRole("link", { name: "Change in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#ai$/);
  await page.getByRole("switch", { name: "Allow agents to post replies" }).click();
  await expect(page.getByText("Agents can post replies").first()).toBeVisible();
  await page.goto("/reviews/mcp");
  await expect(page.getByText("Agents can post replies")).toBeVisible();
  await expect(page.getByText("Access token").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke" })).toBeVisible();
  await audit(page);

  await reset(page);
});
