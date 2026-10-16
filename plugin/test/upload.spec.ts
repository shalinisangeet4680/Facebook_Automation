import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkUploadUrl, collect, uploadToPlatform } from "../src/upload.js";
import { makeProject, screenshot } from "./helpers.js";

const URL_OK = "https://autopilot.example/api/v1/store-uploads";

async function renderedProject() {
  const project = await makeProject();
  const out = path.join(project.dir, "output", "cards");
  for (const [style, lang, size, file] of [
    ["bold", "en", "phone", "01_home"],
    ["bold", "hi", "phone", "01_home"],
    ["light", "en", "tablet7", "01_home"],
  ] as const)
    await screenshot(
      path.join(out, style, lang, size, `${file}.png`),
      1080,
      1920,
    );
  await screenshot(
    path.join(out, "preview", "phone", "minimal", "en", "phone", "01_home.png"),
    1080,
    1920,
  );
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "feature_graphic_dark.jpg"), "jpg");
  await writeFile(path.join(out, "sheet_bold_en_phone.jpg"), "sheet");
  return project;
}

describe("checkUploadUrl", () => {
  it("accepts the store upload endpoint over https or local http", () => {
    expect(checkUploadUrl(URL_OK).host).toBe("autopilot.example");
    expect(
      checkUploadUrl("http://localhost:3200/api/v1/store-uploads").port,
    ).toBe("3200");
  });

  it("refuses other URLs", () => {
    expect(() =>
      checkUploadUrl("http://autopilot.example/api/v1/store-uploads"),
    ).toThrow("https");
    expect(() => checkUploadUrl("https://evil.example/upload")).toThrow(
      "store upload URL",
    );
  });
});

describe("collect", () => {
  it("maps screens, previews and the filtered set to upload items", async () => {
    const { root } = await renderedProject();
    const items = await collect(root, {
      parts: ["screens", "preview", "set"],
      styles: ["bold"],
      langs: ["en"],
    });
    const summary = items.map((i) =>
      [i.kind, i.name, i.style, i.lang, i.size].join(":"),
    );
    expect(summary).toEqual([
      "screen:home:::",
      "screen:orders:::",
      "screenshot:01_home:bold:en:phone",
      "feature_graphic:feature:dark::",
    ]);
  });

  it("collects previews of every style", async () => {
    const { root } = await renderedProject();
    const items = await collect(root, { parts: ["preview"] });
    expect(items.map((i) => `${i.kind}:${i.style}`)).toEqual([
      "preview:minimal",
    ]);
  });
});

describe("uploadToPlatform", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts each image with its fields before the file", async () => {
    const { root } = await renderedProject();
    const calls: { token: string; fields: [string, string][] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: URL, init: RequestInit) => {
        const form = init.body as FormData;
        calls.push({
          token: (init.headers as Record<string, string>)["x-upload-token"]!,
          fields: [...form.entries()].map(([k, v]) => [
            k,
            typeof v === "string" ? v : `blob:${v.type}`,
          ]),
        });
        return new Response("{}", { status: 201 });
      }),
    );
    const result = await uploadToPlatform(root, {
      uploadUrl: URL_OK,
      uploadToken: "stu_abcdefghijk",
      parts: ["set"],
      sizes: ["phone"],
    });
    expect(result).toMatchObject({
      uploaded: 3,
      total: 3,
      byKind: { screenshot: 2, feature_graphic: 1 },
      failed: [],
    });
    expect(calls.every((c) => c.token === "stu_abcdefghijk")).toBe(true);
    const hi = calls.find((c) =>
      c.fields.some(([k, v]) => k === "lang" && v === "hi"),
    )!;
    expect(hi.fields).toEqual([
      ["kind", "screenshot"],
      ["name", "01_home"],
      ["style", "bold"],
      ["lang", "hi"],
      ["size", "phone"],
      ["file", "blob:image/png"],
    ]);
  });

  it("stops and asks for a new token when the platform rejects it", async () => {
    const { root } = await renderedProject();
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: "This upload token is invalid or expired.",
          }),
          {
            status: 401,
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      uploadToPlatform(root, {
        uploadUrl: URL_OK,
        uploadToken: "stu_abcdefghijk",
        parts: ["screens", "set"],
      }),
    ).rejects.toThrow("store_start_upload");
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("reports files the platform refused and keeps going", async () => {
    const { root } = await renderedProject();
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ++n === 1
          ? new Response(
              JSON.stringify({ message: "This file isn't a readable image." }),
              {
                status: 400,
              },
            )
          : new Response("{}", { status: 201 }),
      ),
    );
    const result = await uploadToPlatform(root, {
      uploadUrl: URL_OK,
      uploadToken: "stu_abcdefghijk",
      parts: ["screens"],
    });
    expect(result.uploaded).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.error).toBe("This file isn't a readable image.");
  });
});
