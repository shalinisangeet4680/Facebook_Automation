import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { FEATURE_STYLES, SIZES, STYLES, Size, Style } from "./jobs.js";
import { ProjectError, loadProject } from "./project.js";
import { Progress, measure } from "./render.js";
import { DEFAULT_CARDS } from "./studio.js";

export const UPLOAD_PARTS = ["screens", "preview", "set"] as const;
export type UploadPart = (typeof UPLOAD_PARTS)[number];

export interface UploadItem {
  file: string;
  kind: "screen" | "preview" | "screenshot" | "feature_graphic";
  name: string;
  style: string;
  lang: string;
  size: string;
}

export interface UploadInput {
  cardsId?: string;
  uploadUrl: string;
  uploadToken: string;
  parts: UploadPart[];
  styles?: Style[];
  langs?: string[];
  sizes?: Size[];
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function checkUploadUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProjectError("upload_url is not a URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new ProjectError("upload_url must use https");
  if (!url.pathname.endsWith("/api/v1/store-uploads"))
    throw new ProjectError(
      "upload_url must be the store upload URL returned by store_save_project",
    );
  return url;
}

const dirs = async (dir: string) =>
  existsSync(dir)
    ? (await readdir(dir, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];

const files = async (dir: string) =>
  existsSync(dir)
    ? (await readdir(dir, { withFileTypes: true }))
        .filter((d) => d.isFile() && MIME[path.extname(d.name).toLowerCase()])
        .map((d) => d.name)
        .sort()
    : [];

const allow = <T extends string>(value: string, list?: T[]) =>
  !list?.length || (list as string[]).includes(value);

async function rendered(
  root: string,
  input: Pick<UploadInput, "styles" | "langs" | "sizes">,
  kind: "preview" | "screenshot",
): Promise<UploadItem[]> {
  const items: UploadItem[] = [];
  for (const style of await dirs(root)) {
    if (!(style in STYLES) || !allow(style, input.styles)) continue;
    for (const lang of await dirs(path.join(root, style))) {
      if (!allow(lang, input.langs)) continue;
      for (const size of await dirs(path.join(root, style, lang))) {
        if (!(size in SIZES) || !allow(size, input.sizes)) continue;
        const folder = path.join(root, style, lang, size);
        for (const name of await files(folder))
          items.push({
            file: path.join(folder, name),
            kind,
            name: path.basename(name, path.extname(name)),
            style,
            lang,
            size,
          });
      }
    }
  }
  return items;
}

export async function collect(
  projectRoot: string,
  input: Omit<UploadInput, "uploadUrl" | "uploadToken">,
): Promise<UploadItem[]> {
  const project = await loadProject(
    projectRoot,
    input.cardsId ?? DEFAULT_CARDS,
    measure,
  );
  const out = path.join(project.dir, "output", project.cardsId);
  const items: UploadItem[] = [];
  if (input.parts.includes("screens"))
    for (const screen of project.screens.values())
      items.push({
        file: screen.file,
        kind: "screen",
        name: screen.name,
        style: "",
        lang: "",
        size: "",
      });
  if (input.parts.includes("preview"))
    for (const size of await dirs(path.join(out, "preview")))
      if (size in SIZES)
        items.push(
          ...(await rendered(
            path.join(out, "preview", size),
            input,
            "preview",
          )),
        );
  if (input.parts.includes("set")) {
    items.push(...(await rendered(out, input, "screenshot")));
    for (const style of Object.keys(FEATURE_STYLES)) {
      const file = path.join(out, `feature_graphic_${style}.jpg`);
      if (existsSync(file))
        items.push({
          file,
          kind: "feature_graphic",
          name: "feature",
          style,
          lang: "",
          size: "",
        });
    }
  }
  return items;
}

class TokenRejected extends Error {}

async function send(url: URL, token: string, item: UploadItem) {
  const form = new FormData();
  form.append("kind", item.kind);
  form.append("name", item.name);
  if (item.style) form.append("style", item.style);
  if (item.lang) form.append("lang", item.lang);
  if (item.size) form.append("size", item.size);
  const type = MIME[path.extname(item.file).toLowerCase()] ?? "image/png";
  form.append(
    "file",
    new Blob([await readFile(item.file)], { type }),
    path.basename(item.file),
  );
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "x-upload-token": token },
        body: form,
      });
    } catch (e) {
      if (attempt < 2) continue;
      throw e;
    }
    if (res.ok) return;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 401)
      throw new TokenRejected(body.message ?? "Upload token rejected");
    if (res.status >= 500 && attempt < 2) continue;
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
}

export async function uploadToPlatform(
  projectRoot: string,
  input: UploadInput,
  onProgress: Progress = () => undefined,
) {
  const url = checkUploadUrl(input.uploadUrl);
  if (!input.uploadToken.startsWith("stu_"))
    throw new ProjectError(
      "upload_token must be the token returned by store_save_project",
    );
  const items = await collect(projectRoot, input);
  if (!items.length)
    throw new ProjectError(
      "Nothing to upload. Add screenshots or render a preview or the set first.",
    );
  const failed: { file: string; error: string }[] = [];
  let done = 0;
  let next = 0;
  const state: { rejected: string | null } = { rejected: null };
  const worker = async () => {
    while (next < items.length && !state.rejected) {
      const item = items[next++]!;
      try {
        await send(url, input.uploadToken, item);
      } catch (e) {
        if (e instanceof TokenRejected) state.rejected = e.message;
        else failed.push({ file: item.file, error: (e as Error).message });
      }
      onProgress(++done, items.length, path.basename(item.file));
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (state.rejected)
    throw new ProjectError(
      `${state.rejected} Call store_start_upload for a new token and upload again.`,
    );
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  return {
    uploaded: items.length - failed.length,
    total: items.length,
    byKind: counts,
    failed,
  };
}
