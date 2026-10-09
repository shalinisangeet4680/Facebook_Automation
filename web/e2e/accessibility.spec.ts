import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE, VALID_TOKEN } from "./fixtures";

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} (${n.failureSummary?.split("\n")[1]?.trim() ?? ""})`).join(" | ")}`,
    ),
  ).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.use({ colorScheme: theme });

    test("login", async ({ page }) => {
      await page.goto("/login");
      await audit(page);
    });

    test.describe("signed in", () => {
      test.use({ storageState: STORAGE_STATE });

      for (const path of ["/setup", "/setup/connect-meta", "/setup/accounts"]) {
        test(path, async ({ page }) => {
          await page.request.post("/api/v1/meta/connection", { data: { token: VALID_TOKEN } });
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await audit(page);
        });
      }

      test("connect guide (disconnected)", async ({ page }) => {
        await page.request.delete("/api/v1/meta/connection");
        await page.goto("/setup/connect-meta");
        await page.waitForLoadState("networkidle");
        await audit(page);
      });
    });
  });
}
