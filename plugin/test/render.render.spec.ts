import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderPreview, renderSet } from "../src/studio.js";
import { makeProject } from "./helpers.js";

describe("rendering", () => {
  it("previews every style and renders a Play-ready set", async () => {
    const { root, dir } = await makeProject();

    const preview = await renderPreview(root, {});
    expect(preview.images.map((i) => i.style)).toEqual([
      "callouts",
      "light",
      "bold",
      "minimal",
    ]);
    expect(existsSync(preview.page)).toBe(true);
    expect(existsSync(preview.sheet)).toBe(true);

    const set = await renderSet(root, {
      styles: ["bold"],
      langs: ["en"],
      sizes: ["phone", "tablet10"],
    });
    expect(set.images).toBe(2 * 2 + 2);

    const phone = await sharp(
      path.join(dir, "output", "cards", "bold", "en", "phone", "01_home.png"),
    ).metadata();
    expect(phone).toMatchObject({ width: 1080, height: 1920, channels: 3 });
    expect(phone.hasAlpha).toBe(false);

    const tablet = await sharp(
      path.join(
        dir,
        "output",
        "cards",
        "bold",
        "en",
        "tablet10",
        "02_orders.png",
      ),
    ).metadata();
    expect(tablet).toMatchObject({ width: 3840, height: 2160 });

    const feature = await sharp(set.featureGraphics[0]!).metadata();
    expect(feature).toMatchObject({ width: 1024, height: 500, format: "jpeg" });
    expect(existsSync(path.join(dir, ".gitignore"))).toBe(true);
  });
});
