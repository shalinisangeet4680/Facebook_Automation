import type { CSSProperties } from "react";

export const A = "#0F6B4A";

export const MODE_STYLE: Record<string, [string, string]> = {
  Auto: ["#EAF3EE", A],
  Approval: ["#FBF3E2", "#8A5A00"],
  Manual: ["#EFEDE8", "#55534E"],
  Mixed: ["#ECEFF6", "#3B4A6B"],
  "Needs access": ["#FDF0EE", "#B42318"],
};

export const MODE_LABEL = {
  auto: "Auto",
  approval: "Approval",
  manual: "Manual",
  mixed: "Mixed",
  needs_access: "Needs access",
} as const;

export const MODES = ["auto", "approval", "manual"] as const;
export type RatingMode = (typeof MODES)[number];

export const MODE_DESC: Record<RatingMode, string> = {
  auto: "AI replies and posts on its own, within your rules.",
  approval: "AI drafts every reply. Nothing posts until you approve.",
  manual: "You write replies. AI suggests a draft on request.",
};

export const DIST_COLORS = ["#0F6B4A", "#5A9C7E", "#C9A227", "#D98A4A", "#B42318"];

export const APP_COLORS = ["#E8590C", "#1C64B8", "#2F7D4F", "#6D4AD8", "#76736C"];

export const TOPIC_STYLE: Record<string, [string, string]> = {
  Sync: ["#FDF0EE", "#B42318"],
  Crash: ["#FDF0EE", "#B42318"],
  Login: ["#FDF0EE", "#B42318"],
  Payment: ["#FBF3E2", "#8A5A00"],
  Performance: ["#FBF3E2", "#8A5A00"],
  Ads: ["#FBF3E2", "#8A5A00"],
  Support: ["#FBF3E2", "#8A5A00"],
  "Feature request": ["#ECEFF6", "#3B4A6B"],
  Praise: ["#EAF3EE", A],
};

export const DELAYS = [
  ["instant", "Instantly"],
  ["15m", "15 min"],
  ["1h", "1 hour"],
  ["6h", "6 hours"],
] as const;

export const TONES = [
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["concise", "Concise"],
] as const;

export const PLACEHOLDERS = [
  "user_name",
  "app_name",
  "rating",
  "support_email",
  "version",
  "developer_name",
] as const;

export const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export const rowBorder = (i: number) => (i ? "1px solid #EFEDE8" : "none");

export const appColor = (index: number) => APP_COLORS[index % APP_COLORS.length]!;

export function linePath(values: number[], w: number, h: number, max: number) {
  if (!values.length) return "";
  const m = max || 1;
  return values
    .map(
      (v, i) =>
        (i ? "L" : "M") +
        ((values.length === 1 ? 0 : i / (values.length - 1)) * w).toFixed(1) +
        "," +
        (h - (v / m) * h).toFixed(1),
    )
    .join(" ");
}

export function ratingRange(ratings: number[]) {
  const r = [...ratings].sort((a, b) => a - b);
  if (!r.length) return "—";
  if (r.length > 1 && r[r.length - 1]! - r[0]! === r.length - 1)
    return `${r[0]}–${r[r.length - 1]}★`;
  return `${r.join(",")}★`;
}

export function fillSample(body: string, values: Record<string, string>) {
  return body.replace(/\{\{?\s*([a-z][a-z0-9_]*)\s*(?:\|[^}]*)?\}?\}/g, (m, k: string) => {
    const v = values[k];
    return v === undefined || v === "" ? m : v;
  });
}

export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function until(iso: string, now = Date.now()) {
  const m = Math.round((Date.parse(iso) - now) / 60000);
  if (m <= 0) return "any moment";
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `in ${h}h` : `in ${Math.round(h / 24)}d`;
}

export function minutesLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = minutes / 60;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export const flexCol = (gap: number): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap,
});

export const PRESET_ORDER = [
  "grateful",
  "nudge",
  "follow_up",
  "apology",
  "fixed",
  "bug",
  "billing",
  "feature",
  "updated",
];

export function sortTemplates<T extends { builtIn: boolean; presetKey: string | null }>(list: T[]) {
  const rank = (t: T) => (t.builtIn ? PRESET_ORDER.indexOf(t.presetKey ?? "") : 100);
  return [...list].sort((a, b) => rank(a) - rank(b));
}
