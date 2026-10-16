import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const PROJECT_DIR = ".store-creatives";
export const SCREEN_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour like #1B2536");

const statusBar = z.object({ bg: hex, dark: z.boolean().default(false) });

export const productSchema = z.object({
  name: z.string().min(1),
  wordmark: z.array(z.string().min(1)).min(1).max(2).optional(),
  tagline: z.string().default(""),
  store: z.enum(["Google Play", "App Store"]).nullable().default("Google Play"),
  colors: z
    .object({
      bg: hex,
      bg2: hex,
      bgDeep: hex,
      glow: hex,
      accent: hex,
      onAccent: hex,
      text: hex,
      muted: hex,
      danger: hex,
    })
    .partial()
    .default({}),
  storePalette: z
    .object({
      ink: hex,
      bg: hex,
      line: hex,
      muted: hex,
      text: hex,
      deep: hex,
      mid: hex,
    })
    .partial()
    .optional(),
  logo: z.string().optional(),
  screens: z
    .record(z.string(), z.object({ statusBar: statusBar.optional() }))
    .default({}),
});

const lines = z.array(z.string()).min(1).max(4);
const localized = <T extends z.ZodType>(value: T) =>
  z.record(z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/), value);

export const TONES = [
  "blue",
  "red",
  "teal",
  "green",
  "amber",
  "purple",
] as const;

export const cardSchema = z.object({
  file: z.string().regex(/^[A-Za-z0-9_-]+$/),
  screen: z.string().regex(/^[A-Za-z0-9_-]+$/),
  headline: localized(lines),
  sub: localized(z.string()).optional(),
  callouts: z
    .array(
      z.object({
        tag: z.string().min(1).max(16),
        tone: z.enum(TONES).default("blue"),
        x: z.number().int().min(0).max(1080),
        y: z.number().int().min(0).max(1920),
        w: z.number().int().min(200).max(1000).optional(),
        toggles: z.array(z.tuple([z.string(), z.boolean()])).optional(),
        text: localized(lines),
      }),
    )
    .max(6)
    .default([]),
});

export const cardsSchema = z.array(cardSchema).min(1).max(8);

export type Product = z.infer<typeof productSchema>;
export type Card = z.infer<typeof cardSchema>;

export interface Screen {
  name: string;
  file: string;
  width: number;
  height: number;
}

export interface Project {
  root: string;
  dir: string;
  cardsId: string;
  product: Product;
  cards: Card[];
  screens: Map<string, Screen>;
  logo: string | null;
}

export class ProjectError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
  }
}

export const projectDir = (root: string) => path.join(root, PROJECT_DIR);

const formatIssues = (file: string, error: z.ZodError) =>
  error.issues.map(
    (i) =>
      `${file}: ${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`,
  );

async function readJson<T extends z.ZodType>(
  file: string,
  schema: T,
): Promise<z.infer<T>> {
  if (!existsSync(file))
    throw new ProjectError(`Missing ${path.basename(file)}`, [
      `${file} does not exist`,
    ]);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    throw new ProjectError(`${path.basename(file)} is not valid JSON`, [
      `${file}: ${(e as Error).message}`,
    ]);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ProjectError(
      `${path.basename(file)} is invalid`,
      formatIssues(path.basename(file), parsed.error),
    );
  return parsed.data;
}

export async function findScreens(
  dir: string,
  measure: (file: string) => Promise<{ width: number; height: number }>,
): Promise<Map<string, Screen>> {
  const folder = path.join(dir, "screens");
  const screens = new Map<string, Screen>();
  if (!existsSync(folder)) return screens;
  for (const entry of (await readdir(folder)).sort()) {
    const ext = path.extname(entry).toLowerCase();
    if (!SCREEN_EXTENSIONS.includes(ext)) continue;
    const name = path.basename(entry, path.extname(entry));
    if (screens.has(name)) continue;
    const file = path.join(folder, entry);
    screens.set(name, { name, file, ...(await measure(file)) });
  }
  return screens;
}

function findLogo(dir: string, product: Product): string | null {
  if (product.logo) {
    const file = path.resolve(dir, product.logo);
    return existsSync(file) ? file : null;
  }
  for (const name of ["logo.png", "logo.jpg", "logo.webp"]) {
    const file = path.join(dir, name);
    if (existsSync(file)) return file;
  }
  return null;
}

export async function loadProject(
  root: string,
  cardsId: string,
  measure: (file: string) => Promise<{ width: number; height: number }>,
): Promise<Project> {
  const absRoot = path.resolve(root);
  if (!existsSync(absRoot))
    throw new ProjectError(`Project path ${absRoot} does not exist`);
  const dir = projectDir(absRoot);
  if (!existsSync(dir))
    throw new ProjectError(
      `No ${PROJECT_DIR} folder in ${absRoot}. Create product.json, ${cardsId}.json and screens/ there first.`,
    );
  if (!/^[A-Za-z0-9_-]+$/.test(cardsId))
    throw new ProjectError(`Invalid cards file name "${cardsId}"`);
  const product = await readJson(path.join(dir, "product.json"), productSchema);
  const cards = await readJson(path.join(dir, `${cardsId}.json`), cardsSchema);
  const screens = await findScreens(dir, measure);
  return {
    root: absRoot,
    dir,
    cardsId,
    product,
    cards,
    screens,
    logo: findLogo(dir, product),
  };
}

export const cardLanguages = (card: Card) => Object.keys(card.headline);

export function projectLanguages(project: Project): string[] {
  const all = new Set<string>();
  for (const card of project.cards)
    for (const lang of cardLanguages(card)) all.add(lang);
  return [...all];
}

export function inspect(project: Project, cards = project.cards): string[] {
  const problems: string[] = [];
  const files = new Set<string>();
  for (const card of cards) {
    if (files.has(card.file))
      problems.push(`Card file name "${card.file}" is used twice`);
    files.add(card.file);
    const screen = project.screens.get(card.screen);
    if (!screen)
      problems.push(
        `Card "${card.file}": no screenshot named "${card.screen}" in ${PROJECT_DIR}/screens (${SCREEN_EXTENSIONS.join(", ")})`,
      );
    else if (screen.height <= screen.width)
      problems.push(
        `Screen "${card.screen}" is landscape (${screen.width}x${screen.height}); use a portrait phone screenshot`,
      );
    const langs = cardLanguages(card);
    for (const [i, c] of card.callouts.entries()) {
      const missing = langs.filter((l) => !c.text[l]);
      if (missing.length)
        problems.push(
          `Card "${card.file}" callout ${i + 1} has no text for ${missing.join(", ")}`,
        );
      if (c.x + (c.w ?? 440) > 1080)
        problems.push(
          `Card "${card.file}" callout ${i + 1} runs off the right edge (x + width > 1080)`,
        );
    }
    if (card.sub) {
      const missing = langs.filter((l) => !card.sub?.[l]);
      if (missing.length)
        problems.push(
          `Card "${card.file}" sub has no text for ${missing.join(", ")}`,
        );
    }
  }
  if (project.product.logo && !project.logo)
    problems.push(`Logo ${project.product.logo} not found in ${PROJECT_DIR}`);
  return problems;
}
