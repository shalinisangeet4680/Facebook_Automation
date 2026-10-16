import type { StoreProject } from "@/lib/api/types";

export const STATUS: Record<
  StoreProject["status"],
  { label: string; tone: "neutral" | "accent" | "warning" | "success"; hint: string }
> = {
  draft: {
    label: "Collecting screens",
    tone: "neutral",
    hint: "Claude Code is capturing your app's screens and rendering style previews.",
  },
  choosing: {
    label: "Choose a style",
    tone: "warning",
    hint: "Pick a style, languages and sizes below, then tell Claude Code to render the set.",
  },
  style_chosen: {
    label: "Ready to render",
    tone: "accent",
    hint: "Tell Claude Code to render the set. The images appear here as they upload.",
  },
  rendered: {
    label: "Set ready",
    tone: "success",
    hint: "Download the screenshots for Google Play, or add them to Creatives for app-install ads.",
  },
};

export const STYLE_LABELS: Record<string, { name: string; description: string }> = {
  callouts: {
    name: "Callouts",
    description: "Dark gradient, phone in the middle, white cards pointing at features",
  },
  light: {
    name: "Light",
    description: "Bright background, logo on top, highlighted headline and feature chips",
  },
  bold: {
    name: "Bold",
    description: "Solid brand colour with stripes, uppercase headline, tilted phone",
  },
  minimal: {
    name: "Minimal",
    description: "Deep gradient with a glow, phone first, short two-tone headline",
  },
};

export const SIZE_LABELS: Record<string, string> = {
  phone: "Phone",
  tablet7: "7-inch tablet",
  tablet10: "10-inch tablet",
};

export const FEATURE_LABELS: Record<string, string> = {
  dark: "Feature graphic, dark",
  bold: "Feature graphic, bold",
};

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
