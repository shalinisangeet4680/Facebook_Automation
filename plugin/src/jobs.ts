import path from "node:path";
import { Card, Project, cardLanguages, projectLanguages } from "./project.js";

export const STYLES = {
  callouts:
    "Dark gradient with a dot grid, two-line headline top left, phone in the middle, and white callout cards with coloured tags overlapping both sides of the phone. Callout positions come from the cards file; the most detailed style and the recommended default",
  light:
    "White to soft tint background, logo and wordmark on top, highlighted headline and feature chips",
  bold: "Solid brand accent with diagonal stripes, uppercase headline, tilted phone",
  minimal:
    "Deep gradient with an accent glow, phone first, short two-tone headline underneath",
} as const;

export const FEATURE_STYLES = {
  dark: "Brand gradient, logo, wordmark, tagline and a tilted phone",
  bold: "Solid accent with stripes, logo, name, tagline and a tilted phone",
} as const;

export const SIZES = {
  phone: { width: 1080, height: 1920, scale: 1, label: "Phone, 1080x1920" },
  tablet7: {
    width: 1920,
    height: 1080,
    scale: 1,
    label: "7-inch tablet, 1920x1080",
  },
  tablet10: {
    width: 1920,
    height: 1080,
    scale: 2,
    label: "10-inch tablet, 3840x2160",
  },
} as const;

export type Style = keyof typeof STYLES;
export type FeatureStyle = keyof typeof FEATURE_STYLES;
export type Size = keyof typeof SIZES;

export interface RenderJob {
  composition: "StoreCard" | "FeatureGraphic";
  out: string;
  format: "png" | "jpeg";
  scale: number;
  props: Record<string, unknown>;
}

export interface Plan {
  jobs: RenderJob[];
  groups: Map<string, string[]>;
  staged: Map<string, string>;
}

export interface PlanOptions {
  outDir: string;
  styles: Style[];
  sizes: Size[];
  langs?: string[];
  only?: string[];
  feature: boolean;
}

export const stagedScreen = (file: string, name: string) =>
  `screens/${name}${path.extname(file).toLowerCase()}`;

export const stagedLogo = (file: string) =>
  `logo${path.extname(file).toLowerCase()}`;

const pick = <T>(
  map: Record<string, T> | undefined,
  lang: string,
  fallback: string,
) =>
  map?.[lang] ?? map?.[fallback] ?? (map ? Object.values(map)[0] : undefined);

export function brandProps(project: Project) {
  const p = project.product;
  return {
    name: p.name,
    wordmark: p.wordmark ?? [p.name],
    colors: p.colors,
    store: p.store,
    logo: project.logo ? stagedLogo(project.logo) : null,
  };
}

export function paletteProps(project: Project) {
  const p = project.product;
  if (p.storePalette) return p.storePalette;
  const c = p.colors;
  const map: [string, string | undefined][] = [
    ["ink", c.bg],
    ["bg", c.bg2],
    ["line", c.glow],
    ["muted", c.muted],
    ["text", c.text],
    ["deep", c.bgDeep],
    ["mid", c.bg2],
  ];
  return Object.fromEntries(map.filter(([, v]) => v !== undefined));
}

export function cardProps(project: Project, card: Card, lang: string) {
  const langs = cardLanguages(card);
  const fallback = langs[0] ?? "en";
  const screen = project.screens.get(card.screen);
  if (!screen) throw new Error(`No screenshot for screen "${card.screen}"`);
  const sub = pick(card.sub, lang, fallback);
  return {
    headline: pick(card.headline, lang, fallback) ?? [],
    ...(sub ? { sub } : {}),
    screen: stagedScreen(screen.file, screen.name),
    screenRatio: screen.height / screen.width,
    statusBar: project.product.screens[card.screen]?.statusBar ?? null,
    callouts: card.callouts.map((c) => ({
      tag: c.tag,
      tone: c.tone,
      x: c.x,
      y: c.y,
      ...(c.w ? { w: c.w } : {}),
      ...(c.toggles ? { toggles: c.toggles } : {}),
      text: pick(c.text, lang, fallback) ?? [],
    })),
  };
}

export function selectCards(project: Project, only?: string[]): Card[] {
  if (!only?.length) return project.cards;
  const cards = project.cards.filter(
    (c) => only.includes(c.file) || only.includes(c.screen),
  );
  if (!cards.length)
    throw new Error(
      `No card matches ${only.join(", ")}. Cards: ${project.cards.map((c) => c.file).join(", ")}`,
    );
  return cards;
}

export function plan(project: Project, options: PlanOptions): Plan {
  const cards = selectCards(project, options.only);
  const known = projectLanguages(project);
  const unknown = (options.langs ?? []).filter((l) => !known.includes(l));
  if (unknown.length)
    throw new Error(
      `Unknown language ${unknown.join(", ")}. The cards have: ${known.join(", ")}`,
    );
  const brand = brandProps(project);
  const palette = paletteProps(project);
  const jobs: RenderJob[] = [];
  const groups = new Map<string, string[]>();
  const staged = new Map<string, string>();
  for (const card of cards) {
    const screen = project.screens.get(card.screen);
    if (screen) staged.set(stagedScreen(screen.file, screen.name), screen.file);
    const langs = cardLanguages(card).filter(
      (l) => !options.langs?.length || options.langs.includes(l),
    );
    for (const lang of langs) {
      const props = cardProps(project, card, lang);
      for (const style of options.styles)
        for (const size of options.sizes) {
          const { width, height, scale } = SIZES[size];
          const key = `${style}/${lang}/${size}`;
          const out = path.join(
            options.outDir,
            style,
            lang,
            size,
            `${card.file}.png`,
          );
          jobs.push({
            composition: "StoreCard",
            out,
            format: "png",
            scale,
            props: { style, width, height, card: props, brand, palette },
          });
          groups.set(key, [...(groups.get(key) ?? []), out]);
        }
    }
  }
  const first = cards[0];
  if (options.feature && first) {
    const props = cardProps(project, first, cardLanguages(first)[0] ?? "en");
    for (const style of Object.keys(FEATURE_STYLES))
      jobs.push({
        composition: "FeatureGraphic",
        out: path.join(options.outDir, `feature_graphic_${style}.jpg`),
        format: "jpeg",
        scale: 1,
        props: {
          style,
          brand,
          palette,
          screen: props.screen,
          screenRatio: props.screenRatio,
          statusBar: props.statusBar,
          tagline: project.product.tagline,
        },
      });
  }
  if (project.logo) staged.set(stagedLogo(project.logo), project.logo);
  return { jobs, groups, staged };
}
