import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

const key = (email: string) =>
  JSON.stringify({
    type: "service_account",
    project_id: "acme-play",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n",
    client_email: email,
  });

test("finds every app a new Google Play account can see", async ({ page }) => {
  const base = await page.request.post("/api/v1/play/connections", {
    data: { key: key("autopilot@acme-play.iam.gserviceaccount.com") },
  });
  expect(base.ok()).toBeTruthy();

  await page.goto("/reviews");
  await page.getByRole("button", { name: "Connect another account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Service account key (JSON)")
    .fill(key("discover@acme-play.iam.gserviceaccount.com"));
  await dialog.getByRole("button", { name: "Connect" }).click();

  const panel = page.getByRole("status").filter({ hasText: "Found 3 apps" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("No Reply Access");
  await expect(page.getByRole("link", { name: /Discover Shop/ }).first()).toBeVisible();

  const account = page
    .getByRole("listitem")
    .filter({ hasText: "discover@acme-play.iam.gserviceaccount.com" });
  await account.getByRole("button", { name: "Find apps" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "0 added, 2 already here" }),
  ).toBeVisible();

  const list = (await (await page.request.get("/api/v1/play/connections")).json()) as {
    data: { id: string; clientEmail: string }[];
  };
  for (const c of list.data.filter((c) => c.clientEmail.startsWith("discover")))
    await page.request.delete(`/api/v1/play/connections/${c.id}`);
});
