import type { PlayApp, PlayReviewState, PlayTemplate } from "@/lib/api/types";

export const MODE: Record<
  PlayApp["mode"],
  { label: string; tone: "neutral" | "warning" | "success" }
> = {
  off: { label: "Automation off", tone: "neutral" },
  approval: { label: "Needs approval", tone: "warning" },
  auto: { label: "Auto-send on", tone: "success" },
};

export const STATES: { value: PlayReviewState | "all"; label: string }[] = [
  { value: "unreplied", label: "Needs reply" },
  { value: "waiting", label: "Waiting for approval" },
  { value: "claude", label: "For Claude" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
  { value: "replied", label: "Replied" },
  { value: "all", label: "All" },
];

export const CATEGORY: Record<PlayTemplate["category"], string> = {
  positive: "Positive",
  negative: "Negative",
  bug: "Bug or crash",
  feature: "Feature request",
  billing: "Payment",
  updated: "Updated review",
  neutral: "Mixed",
  custom: "Custom",
};

export const LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  ar: "Arabic",
  id: "Indonesian",
};

export function languageLabel(code: string | null | undefined): string {
  if (!code) return "Unknown language";
  const base = code.toLowerCase().split(/[-_]/)[0] ?? code;
  if (LANGUAGES[base]) return LANGUAGES[base]!;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export const REPLY_MAX = 350;
