import { createHash } from "crypto";

import { REPLY_MAX, TemplateBody } from "./play.types";

export const charCount = (text: string) => text.length;

export const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,31}$/;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*(?:\|([^}]*))?\}\}/g;

export const BUILT_IN_VARIABLES = [
  "first_name",
  "app_name",
  "latest_version",
] as const;

export const SUGGESTED_VARIABLES = [
  "team_name",
  "support_email",
  "support_phone",
  "support_url",
] as const;

export const SAMPLE_VALUES: Record<string, string> = {
  first_name: "Christopher",
  app_name: "Your App",
  latest_version: "10.12.3",
};

export interface Placeholder {
  name: string;
  fallback: string | null;
}

export function placeholders(text: string): Placeholder[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => ({
    name: m[1]!,
    fallback: m[2] === undefined ? null : m[2].trim(),
  }));
}

export interface Rendered {
  text: string;
  missing: string[];
  tooLong: boolean;
}

export function render(
  template: string,
  values: Record<string, string | null | undefined>,
): Rendered {
  const missing = new Set<string>();
  const text = template
    .replace(PLACEHOLDER, (_, name: string, fallback?: string) => {
      const value = values[name]?.trim();
      if (value) return value;
      if (fallback !== undefined) return fallback.trim();
      missing.add(name);
      return "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .replace(/[,;:]+([.!?])/g, "$1")
    .trim();
  return {
    text,
    missing: [...missing],
    tooLong: charCount(text) > REPLY_MAX,
  };
}

export function firstName(authorName: string | null | undefined): string {
  const name = (authorName ?? "").trim();
  if (!name || /^a google user$/i.test(name)) return "";
  const first = name.split(/\s+/)[0] ?? "";
  if (!/\p{L}/u.test(first) || first.length > 24) return "";
  return first;
}

const base = (lang: string) => lang.toLowerCase().split(/[-_]/)[0] ?? "";

export function pickBody(
  bodies: TemplateBody[],
  language: string | null,
): TemplateBody | null {
  if (!bodies.length) return null;
  if (language) {
    const lang = language.toLowerCase().replace("_", "-");
    const exact = bodies.find((b) => b.language.toLowerCase() === lang);
    if (exact) return exact;
    const sameBase = bodies.find((b) => base(b.language) === base(lang));
    if (sameBase) return sameBase;
  }
  return bodies[0]!;
}

export function pickVariant(variants: string[], seed: string): string {
  if (variants.length <= 1) return variants[0] ?? "";
  const n = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return variants[n % variants.length]!;
}

export interface TemplateCheck {
  language: string;
  variant: number;
  problem: string;
}

export function checkTemplate(
  bodies: TemplateBody[],
  known: Record<string, string | null | undefined>,
): TemplateCheck[] {
  const problems: TemplateCheck[] = [];
  const languages = new Set<string>();
  bodies.forEach((body) => {
    if (languages.has(body.language.toLowerCase()))
      problems.push({
        language: body.language,
        variant: 0,
        problem: `${body.language} is listed twice`,
      });
    languages.add(body.language.toLowerCase());
    body.variants.forEach((variant, i) => {
      if (!variant.trim())
        problems.push({
          language: body.language,
          variant: i,
          problem: "This wording is empty",
        });
      for (const raw of variant.match(/\{\{[^}]*\}\}/g) ?? [])
        if (!/^\{\{\s*[a-z][a-z0-9_]{0,31}\s*(\|[^}]*)?\}\}$/.test(raw))
          problems.push({
            language: body.language,
            variant: i,
            problem: `${raw} is not a valid placeholder; use lowercase names like {{support_email}}`,
          });
      for (const p of placeholders(variant)) {
        const builtIn = (BUILT_IN_VARIABLES as readonly string[]).includes(
          p.name,
        );
        if (!builtIn && !known[p.name]?.trim() && p.fallback === null)
          problems.push({
            language: body.language,
            variant: i,
            problem: `{{${p.name}}} has no value in this app's settings and no fallback`,
          });
      }
      const longest = render(variant, { ...SAMPLE_VALUES, ...filled(known) });
      if (longest.tooLong)
        problems.push({
          language: body.language,
          variant: i,
          problem: `Can reach ${charCount(longest.text)} characters; Google Play allows ${REPLY_MAX}`,
        });
    });
  });
  return problems;
}

function filled(known: Record<string, string | null | undefined>) {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(known))
    if (value?.trim() && name !== "first_name") out[name] = value;
  return out;
}
