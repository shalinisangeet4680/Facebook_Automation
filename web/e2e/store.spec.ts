import { deflateSync, crc32 } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures";

test.use({ storageState: STORAGE_STATE });

function png(width: number, height: number, rgb: [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const COLORS: Record<string, [number, number, number]> = {
  callouts: [27, 37, 54],
  light: [221, 230, 238],
  bold: [76, 196, 106],
  minimal: [20, 28, 42],
};

async function upload(
  request: APIRequestContext,
  token: string,
  fields: Record<string, string>,
  image: Buffer,
) {
  const res = await request.post("/api/v1/store-uploads", {
    headers: { "x-upload-token": token },
    multipart: {
      ...fields,
      file: { name: `${fields.name}.png`, mimeType: "image/png", buffer: image },
    },
  });
  expect(res.ok(), `upload failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

test("chooses a style for the plugin's previews and gets the set back", async ({ page }, info) => {
  const name = `Acme ${Date.now()}`;
  const created = await page.request.post("/api/v1/store-projects", {
    data: { name, languages: ["en", "hi"] },
  });
  expect(created.ok()).toBeTruthy();
  const { projectId, uploadToken } = (await created.json()) as {
    projectId: string;
    uploadToken: string;
  };

  await upload(
    page.request,
    uploadToken,
    { kind: "screen", name: "home" },
    png(540, 1200, [240, 244, 248]),
  );
  for (const style of Object.keys(COLORS))
    await upload(
      page.request,
      uploadToken,
      { kind: "preview", name: "01_home", style, lang: "en", size: "phone" },
      png(540, 960, COLORS[style]!),
    );

  await page.goto("/store");
  const card = page.getByRole("link", { name: new RegExp(name) });
  await expect(card).toContainText("Choose a style");
  await card.click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  const styles = page.getByRole("radiogroup", { name: "Screenshot style" });
  await expect(styles.getByRole("radio")).toHaveCount(4);
  await styles.getByRole("radio", { name: /Bold/ }).click();
  await page.getByRole("button", { name: "Hindi" }).click();
  await page.getByRole("button", { name: "7-inch tablet" }).click();
  await page.getByRole("button", { name: "Use this style" }).click();
  await expect(page.getByText("Now go back to Claude Code")).toBeVisible();
  await expect(page.getByText("Ready to render").filter({ visible: true })).toBeVisible();

  const project = await page.request.get(`/api/v1/store-projects/${projectId}`);
  expect(((await project.json()) as { choice: unknown }).choice).toEqual({
    style: "bold",
    languages: ["en"],
    sizes: ["phone", "tablet7"],
  });

  const accessibility = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} (${n.failureSummary?.split("\n")[1]?.trim() ?? ""})`).join(" | ")}`,
      ),
  ).toEqual([]);

  for (const card of ["01_home", "02_orders"])
    await upload(
      page.request,
      uploadToken,
      { kind: "screenshot", name: card, style: "bold", lang: "en", size: "phone" },
      png(540, 960, COLORS.bold!),
    );
  await upload(
    page.request,
    uploadToken,
    { kind: "feature_graphic", name: "feature", style: "dark" },
    png(1024, 500, COLORS.minimal!),
  );

  const set = page.getByRole("region", { name: "Your store set" });
  await expect(set).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Set ready").filter({ visible: true })).toBeVisible();
  await expect(set.getByRole("checkbox")).toHaveCount(3);
  await expect(set.getByRole("link", { name: /Download 1\. 01_home/ })).toHaveAttribute(
    "download",
    "01_home_bold_en_phone.png",
  );
  await page.screenshot({ path: info.outputPath("store-set.png"), fullPage: true });

  await set.getByRole("checkbox", { name: /01_home/ }).check();
  await set.getByRole("button", { name: /Add 1 to Creatives/ }).click();
  await expect(page.getByText("1 added to Creatives")).toBeVisible();

  await page.goto("/creatives");
  await expect(page.getByText(`${name} · 01_home (bold, en, phone)`)).toBeVisible();
});
