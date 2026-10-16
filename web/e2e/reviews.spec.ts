import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

const KEY = JSON.stringify({
  type: "service_account",
  project_id: "acme-play",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n",
  client_email: "autopilot@acme-play.iam.gserviceaccount.com",
});

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} (${n.failureSummary?.split("\n")[1]?.trim() ?? ""})`).join(" | ")}`,
      ),
  ).toEqual([]);
}

test("replies to Play reviews with drafts, templates, rules and settings", async ({
  page,
}, info) => {
  const stamp = Date.now();
  const leftovers = (await (await page.request.get("/api/v1/play/apps")).json()) as {
    data: { id: string; title: string }[];
  };
  for (const a of leftovers.data.filter((a) => a.title.startsWith("E2E Shop")))
    await page.request.delete(`/api/v1/play/apps/${a.id}`);
  const connected = await page.request.post("/api/v1/play/connections", { data: { key: KEY } });
  expect(connected.ok(), await connected.text()).toBeTruthy();
  const { id: connectionId } = (await connected.json()) as { id: string };
  const packageName = `com.e2e.shop${stamp}`;
  const added = await page.request.post("/api/v1/play/apps", {
    data: { connectionId, packageName, title: `E2E Shop ${stamp}` },
  });
  expect(added.ok(), await added.text()).toBeTruthy();
  const app = (await added.json()) as { id: string };
  const templateName = `Call support ${stamp}`;

  try {
    await page.goto("/reviews");
    const card = page.getByRole("link", { name: new RegExp(`E2E Shop ${stamp}`) });
    await expect(card).toContainText("Needs approval");
    await audit(page);
    await card.click();

    await expect(page.getByRole("heading", { name: `E2E Shop ${stamp}` })).toBeVisible();
    const status = page.getByRole("group", { name: "Review status" });
    await expect(status.getByRole("button", { name: /Waiting for approval/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(status.getByRole("button", { name: /Waiting for approval/ })).toContainText("8");

    const priya = page.getByRole("listitem").filter({ hasText: "Priya Sharma" });
    const reply = priya.getByRole("textbox", { name: "Reply to Priya Sharma" });
    await expect(reply).toHaveValue(/Priya|lovely|Thank/);
    await reply.fill("Thank you Priya, we're so glad it helps!");
    await expect(priya.getByText("40/350")).toBeVisible();
    await priya.getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByText("Reply posted on Google Play")).toBeVisible();
    await expect(status.getByRole("button", { name: /Waiting for approval/ })).toContainText("7");
    await page.screenshot({ path: info.outputPath("reviews.png"), fullPage: true });
    await audit(page);

    await status.getByRole("button", { name: /Replied/ }).click();
    await expect(page.getByText("Thank you Priya, we're so glad it helps!")).toBeVisible();

    await page.getByRole("tab", { name: "Templates" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    const editor = page.getByRole("dialog");
    await editor.getByLabel("Name").fill(templateName);
    await editor.getByLabel("Wording 1").fill("Sorry ");
    await editor.getByRole("button", { name: "{{first_name}}" }).click();
    await editor.getByLabel("Wording 1").press("End");
    await editor.getByLabel("Wording 1").pressSequentially("! Call {{support_phone|our team}}.");
    await expect(editor.getByText("Sorry Priya! Call our team.")).toBeVisible();
    await page.screenshot({ path: info.outputPath("template-editor.png") });
    await editor.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText("Template saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: templateName })).toBeVisible();

    await page.getByRole("tab", { name: "Rules" }).click();
    const thanks = page.getByRole("listitem").filter({ hasText: "Thank happy reviewers" });
    await expect(thanks).toContainText("When 4★ 5★ → Reply with “Thank you” · after I approve");
    await thanks.getByRole("button", { name: "Edit" }).click();
    const open = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Done" }) });
    await expect(open.getByRole("textbox", { name: "Rule name" })).toHaveValue(
      "Thank happy reviewers",
    );
    await open.getByRole("radio", { name: "Automatically" }).click();
    await expect(open.getByText("Replies from this rule go out on their own")).toBeVisible();
    await page.getByRole("button", { name: "Save rules" }).click();
    await expect(page.getByText("Rules saved")).toBeVisible();
    await expect(page.getByText("Auto-send on")).toBeVisible();
    await page.screenshot({ path: info.outputPath("rules.png"), fullPage: true });
    await audit(page);

    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.getByText("Average rating").first()).toBeVisible();
    await page.getByRole("button", { name: "Import history" }).click();
    const header =
      "Package Name,App Version Code,App Version Name,Reviewer Language,Device,Review Submit Date and Time,Review Submit Millis Since Epoch,Review Last Update Date and Time,Review Last Update Millis Since Epoch,Star Rating,Review Title,Review Text,Developer Reply Date and Time,Developer Reply Millis Since Epoch,Developer Reply Text,Review Link";
    const rows = Array.from({ length: 24 }, (_, i) => {
      const at = Date.now() - (i + 8) * 86_400_000;
      const stars = [5, 4, 5, 1, 3, 2][i % 6];
      const text =
        stars <= 2
          ? "Login fails after update, payment stuck"
          : stars >= 4
            ? "Fast delivery, easy checkout"
            : "";
      return `${packageName},${210 + (i % 3)},2.${1 + (i % 3)}.0,${i % 4 ? "en" : "hi"},a05m,,${at},,${at},${stars},,"${text}",,,,http://x/review-details?reviewId=gp:HIST${stamp}${i}`;
    });
    const csv = [header, ...rows].join("\n");
    await page.getByLabel("Choose review report files").setInputFiles({
      name: `reviews_${packageName}_202609.csv`,
      mimeType: "text/csv",
      buffer: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, "utf16le")]),
    });
    await expect(page.getByText("24 reviews imported")).toBeVisible();
    await page
      .getByRole("group", { name: "Period" })
      .getByRole("button", { name: "90 days" })
      .click();
    await expect(page.getByRole("img", { name: "Reviews by star rating over time" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Common words in unhappy reviews" })).toContainText(
      "login",
    );
    const versions = page.getByRole("region", { name: "Rating by app version" });
    await versions.getByRole("button", { name: "Table" }).click();
    await expect(versions.getByRole("cell", { name: "2.1.0" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("insights-light.png"), fullPage: true });
    await audit(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath("insights-dark.png"), fullPage: true });
    await audit(page);
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/reviews");
    await expect(page.getByText("Need a reply").first()).toBeVisible();
    await page.screenshot({ path: info.outputPath("apps.png"), fullPage: true });
    await page.getByRole("link", { name: new RegExp(`E2E Shop ${stamp}`) }).click();

    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByLabel("Value for support_email").fill("help@e2e.shop");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await audit(page);
  } finally {
    await page.request.delete(`/api/v1/play/apps/${app.id}`);
    const templates = (await (await page.request.get("/api/v1/play/templates")).json()) as {
      data: { id: string; name: string }[];
    };
    for (const t of templates.data.filter((t) => t.name.startsWith("Call support")))
      await page.request.delete(`/api/v1/play/templates/${t.id}`);
  }
});
