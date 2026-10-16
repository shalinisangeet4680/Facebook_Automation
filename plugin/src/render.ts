import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  openBrowser,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import sharp from "sharp";
import { RenderJob } from "./jobs.js";

export const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const ENTRY = path.join(PACKAGE_ROOT, "templates", "index.ts");

export type Progress = (done: number, total: number, message: string) => void;

export async function measure(file: string) {
  const meta = await sharp(file).metadata();
  if (!meta.width || !meta.height)
    throw new Error(`Can't read the size of ${file}`);
  return { width: meta.width, height: meta.height };
}

export async function ensureGitignore(dir: string) {
  const file = path.join(dir, ".gitignore");
  if (!existsSync(file)) await writeFile(file, "output/\n.cache/\n");
}

async function stage(publicDir: string, staged: Map<string, string>) {
  await rm(publicDir, { recursive: true, force: true });
  for (const [target, source] of staged) {
    const dest = path.join(publicDir, target);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(source, dest);
  }
}

async function flatten(file: string) {
  const buffer = await sharp(file)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(file, buffer);
}

export async function renderJobs(
  jobs: RenderJob[],
  staged: Map<string, string>,
  publicDir: string,
  onProgress: Progress = () => undefined,
) {
  const total = jobs.length;
  onProgress(0, total, "Preparing templates");
  await stage(publicDir, staged);
  await ensureBrowser({ logLevel: "error" });
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir,
    enableCaching: true,
  });
  const browser = await openBrowser("chrome", { logLevel: "error" });
  try {
    for (const [i, job] of jobs.entries()) {
      const composition = await selectComposition({
        serveUrl,
        id: job.composition,
        inputProps: job.props,
        puppeteerInstance: browser,
        logLevel: "error",
      });
      await mkdir(path.dirname(job.out), { recursive: true });
      await renderStill({
        composition,
        serveUrl,
        output: job.out,
        inputProps: job.props,
        imageFormat: job.format,
        ...(job.format === "jpeg" ? { jpegQuality: 92 } : {}),
        scale: job.scale,
        overwrite: true,
        puppeteerInstance: browser,
        logLevel: "error",
      });
      if (job.format === "png") await flatten(job.out);
      onProgress(i + 1, total, path.basename(job.out));
    }
  } finally {
    await browser.close({ silent: true });
  }
}

export async function contactSheet(
  files: string[],
  out: string,
  cols = 4,
  thumb = 360,
) {
  if (!files.length) return;
  const thumbs = await Promise.all(
    files.map((f) =>
      sharp(f)
        .resize({ width: thumb })
        .png()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const gap = 16;
  const cellH = Math.max(...thumbs.map((t) => t.info.height));
  const rows = Math.ceil(thumbs.length / cols);
  const columns = Math.min(cols, thumbs.length);
  await sharp({
    create: {
      width: columns * thumb + (columns + 1) * gap,
      height: rows * cellH + (rows + 1) * gap,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(
      thumbs.map((t, i) => ({
        input: t.data,
        left: gap + (i % cols) * (thumb + gap),
        top: gap + Math.floor(i / cols) * (cellH + gap),
      })),
    )
    .jpeg({ quality: 82 })
    .toFile(out);
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function previewPage(
  out: string,
  title: string,
  items: { style: string; description: string; image: string }[],
) {
  const cards = items
    .map(
      (i) => `<figure>
  <img src="${escape(i.image)}" alt="${escape(i.style)} style">
  <figcaption><strong>${escape(i.style)}</strong><span>${escape(i.description)}</span></figcaption>
</figure>`,
    )
    .join("\n");
  await writeFile(
    out,
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #f6f7f9; --card: #fff; --text: #1b2536; --muted: #5b6676; }
@media (prefers-color-scheme: dark) { :root { --bg: #11151c; --card: #1a202a; --text: #eef2f6; --muted: #9aa5b4; } }
body { margin: 0; padding: 32px 16px; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1200px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; }
p { color: var(--muted); margin: 0 0 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
figure { margin: 0; background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
img { display: block; width: 100%; height: auto; }
figcaption { padding: 12px 14px; display: grid; gap: 2px; }
figcaption span { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
<h1>${escape(title)}</h1>
<p>Tell Claude which style you want, for example "use bold".</p>
<div class="grid">
${cards}
</div>
</main>
</body>
</html>
`,
  );
}
