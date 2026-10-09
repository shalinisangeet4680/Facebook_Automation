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

      for (const path of [
        "/setup",
        "/setup/connect-meta",
        "/setup/accounts",
        "/claude",
        "/campaigns",
      ]) {
        test(path, async ({ page }) => {
          await page.request.post("/api/v1/meta/connection", { data: { token: VALID_TOKEN } });
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await audit(page);
        });
      }

      test("Claude consent screen", async ({ page }) => {
        const reg = await page.request.post("/oauth/register", {
          data: {
            client_name: "Claude",
            redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
            token_endpoint_auth_method: "none",
          },
        });
        const { client_id } = (await reg.json()) as { client_id: string };
        const params = new URLSearchParams({
          response_type: "code",
          client_id,
          redirect_uri: "https://claude.ai/api/mcp/auth_callback",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: "S256",
          state: "a11y",
          scope: "ads:read ads:write",
        });
        await page.goto(`/oauth/authorize?${params}`);
        await expect(page.getByRole("button", { name: "Allow" })).toBeVisible();
        await expect(page.getByText("Connect Claude to Autopilot")).toBeVisible();
        await page.waitForTimeout(600);
        await audit(page);
      });

      test("connect guide (disconnected)", async ({ page }) => {
        await page.request.delete("/api/v1/meta/connection");
        await page.goto("/setup/connect-meta");
        await page.waitForLoadState("networkidle");
        await audit(page);
      });
    });
  });
}
