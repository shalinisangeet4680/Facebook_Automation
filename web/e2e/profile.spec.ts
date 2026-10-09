import { expect, test } from "@playwright/test";

import { STORAGE_STATE, ensureMetaConnected } from "./fixtures";
import { COVER_PNG, LOGO_PNG } from "./profile-images";

test.use({ storageState: STORAGE_STATE });

test("drafts the Page profile with a logo and cover and applies it", async ({ page }, info) => {
  await ensureMetaConnected(page.request);
  const tag = Date.now();
  for (const [name, data] of [
    [`logo-${tag}`, LOGO_PNG],
    [`cover-${tag}`, COVER_PNG],
  ] as const) {
    const res = await page.request.post("/api/v1/creatives", {
      multipart: {
        name,
        file: { name: `${name}.png`, mimeType: "image/png", buffer: Buffer.from(data, "base64") },
      },
    });
    expect(res.ok()).toBeTruthy();
  }

  await page.goto("/profile");
  await expect(page.getByText(/% complete/).first()).toBeVisible();

  const chooseFor = async (label: string, name: string) => {
    await page
      .getByRole("group", { name: label })
      .first()
      .getByRole("button", { name: "Choose" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) })
      .click();
  };
  await chooseFor("Profile picture", `logo-${tag}`);
  await chooseFor("Cover photo", `cover-${tag}`);
  await page
    .getByLabel("Short description")
    .fill(
      "Clinic management software for Indian doctors: appointments, prescriptions, billing and WhatsApp reminders.",
    );
  await page.getByLabel("Website").first().fill("https://arogyasystem.com");
  await page.getByLabel("Phone").fill("+91 84342 30999");
  await page.getByRole("button", { name: "Save draft" }).first().click();
  await expect(page.getByText("Facebook draft saved")).toBeVisible();

  await page.getByRole("button", { name: "Apply to Page" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Update Page" }).click();
  await expect(page.getByText("Page updated")).toBeVisible();
  await expect(page.getByText("100% complete").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("profile.png"), fullPage: true });
});
