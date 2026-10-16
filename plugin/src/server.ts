#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { registerDeviceTools } from "./device/tools.js";
import { SIZES, STYLES, Size, Style } from "./jobs.js";
import { ProjectError } from "./project.js";
import { PACKAGE_ROOT } from "./render.js";
import { UPLOAD_PARTS, uploadToPlatform } from "./upload.js";
import {
  DEFAULT_CARDS,
  checkProject,
  listStyles,
  renderPreview,
  renderSet,
} from "./studio.js";

console.log = console.error;
console.info = console.error;
console.warn = console.error;

const { version } = JSON.parse(
  readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
) as { version: string };

const styleName = z.enum(Object.keys(STYLES) as [Style, ...Style[]]);
const sizeName = z.enum(Object.keys(SIZES) as [Size, ...Size[]]);
const projectPath = z
  .string()
  .min(1)
  .describe(
    "Absolute path to the app repository. Its .store-creatives folder holds product.json, the cards file, screens/ and the logo.",
  );
const cards = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .default(DEFAULT_CARDS)
  .describe("Cards file name inside .store-creatives, without .json");

const json = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

async function run(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return json(await work());
  } catch (e) {
    const problems = e instanceof ProjectError ? e.problems : [];
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: [(e as Error).message, ...problems.map((p) => `- ${p}`)].join(
            "\n",
          ),
        },
      ],
    };
  }
}

const server = new McpServer({ name: "store-creatives", version });

server.registerTool(
  "list_styles",
  {
    title: "List store styles",
    description:
      "The screenshot styles, feature graphic styles and Play Store sizes this plugin can render.",
    annotations: { readOnlyHint: true },
  },
  () => run(async () => listStyles()),
);

server.registerTool(
  "check_project",
  {
    title: "Check a store creatives project",
    description:
      "Validates .store-creatives/product.json, the cards file, screenshots and logo, and lists every problem to fix before rendering.",
    inputSchema: { project_path: projectPath, cards },
    annotations: { readOnlyHint: true },
  },
  (a) => run(() => checkProject(a.project_path, a.cards)),
);

const progress =
  (extra: {
    _meta?: { progressToken?: string | number };
    sendNotification: (n: {
      method: "notifications/progress";
      params: {
        progressToken: string | number;
        progress: number;
        total: number;
        message: string;
      };
    }) => Promise<void>;
  }) =>
  (done: number, total: number, message: string) => {
    const token = extra._meta?.progressToken;
    if (token === undefined) return;
    extra
      .sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress: done, total, message },
      })
      .catch(() => undefined);
  };

server.registerTool(
  "render_preview",
  {
    title: "Preview every style",
    description:
      "Renders one card in every style so the user can choose. Writes the images, a contact sheet and an index.html gallery under .store-creatives/output/<cards>/preview/<size>/. Open index.html for the user.",
    inputSchema: {
      project_path: projectPath,
      cards,
      card: z
        .string()
        .optional()
        .describe("Card file or screen name; defaults to the first card"),
      lang: z
        .string()
        .optional()
        .describe("Language code; defaults to the card's first language"),
      size: sizeName.default("phone"),
    },
  },
  (a, extra) =>
    run(() =>
      renderPreview(
        a.project_path,
        {
          cardsId: a.cards,
          card: a.card,
          lang: a.lang,
          size: a.size,
        },
        progress(extra),
      ),
    ),
);

server.registerTool(
  "render_set",
  {
    title: "Render the store set",
    description:
      "Renders every chosen card in the chosen styles, languages and sizes, plus 1024x500 feature graphics. PNGs have no alpha channel, as Google Play requires. Output goes to .store-creatives/output/<cards>/<style>/<lang>/<size>/ with a contact sheet per set. Can take a few minutes.",
    inputSchema: {
      project_path: projectPath,
      cards,
      styles: z.array(styleName).optional().describe("Defaults to every style"),
      langs: z
        .array(z.string())
        .optional()
        .describe("Defaults to every language in the cards"),
      sizes: z
        .array(sizeName)
        .optional()
        .describe("Defaults to phone, tablet7 and tablet10"),
      only: z
        .array(z.string())
        .optional()
        .describe("Card file or screen names; defaults to every card"),
      feature_graphic: z.boolean().default(true),
    },
  },
  (a, extra) =>
    run(() =>
      renderSet(
        a.project_path,
        {
          cardsId: a.cards,
          styles: a.styles,
          langs: a.langs,
          sizes: a.sizes,
          only: a.only,
          feature: a.feature_graphic,
        },
        progress(extra),
      ),
    ),
);

server.registerTool(
  "upload_to_platform",
  {
    title: "Upload to Autopilot",
    description:
      "Uploads images from .store-creatives straight to the Autopilot store listing project, without passing them through the conversation. Get upload_url and upload_token from the Autopilot connector's store_save_project or store_start_upload tool. parts: screens (the screenshots in screens/), preview (every rendered style preview), set (the rendered screenshots and feature graphics, filtered by styles, langs and sizes). Re-uploading replaces the same image.",
    inputSchema: {
      project_path: projectPath,
      cards,
      upload_url: z.string().url(),
      upload_token: z.string().min(10),
      parts: z.array(z.enum(UPLOAD_PARTS)).min(1),
      styles: z.array(styleName).optional(),
      langs: z.array(z.string()).optional(),
      sizes: z.array(sizeName).optional(),
    },
    annotations: { openWorldHint: true },
  },
  (a, extra) =>
    run(() =>
      uploadToPlatform(
        a.project_path,
        {
          cardsId: a.cards,
          uploadUrl: a.upload_url,
          uploadToken: a.upload_token,
          parts: a.parts,
          styles: a.styles,
          langs: a.langs,
          sizes: a.sizes,
        },
        progress(extra),
      ),
    ),
);

registerDeviceTools(server);

await server.connect(new StdioServerTransport());
