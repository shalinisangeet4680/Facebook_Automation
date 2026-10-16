import { createHash } from "crypto";

import { REPLY_MAX, TemplateBody } from "./play.types";

export const charCount = (text: string) => text.length;

export const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,31}$/;
const PLACEHOLDER =
  /\{\{\s*([a-z][a-z0-9_]{0,31})\s*(?:\|([^}]*))?\}\}|(?<!\{)\{([a-z][a-z0-9_]{0,31})\}(?!\})/g;

export const DEFAULT_FALLBACKS: Record<string, string> = {
  user_name: "there",
  developer_name: "The team",
  team_name: "The team",
  version: "the latest version",
  latest_version: "the latest version",
};

export const ALIASES: Record<string, string> = {
  user_name: "first_name",
  version: "latest_version",
  developer_name: "team_name",
};

export const BUILT_IN_VARIABLES = [
  "user_name",
  "app_name",
  "rating",
  "version",
  "first_name",
  "latest_version",
] as const;

export const SUGGESTED_VARIABLES = [
  "support_email",
  "developer_name",
  "support_phone",
  "support_url",
] as const;

export const PLACEHOLDER_CHIPS = [
  "user_name",
  "app_name",
  "rating",
  "support_email",
  "version",
  "developer_name",
] as const;

export const SAMPLE_VALUES: Record<string, string> = {
  first_name: "Christopher",
  user_name: "Christopher",
  app_name: "Your App",
  rating: "5",
  latest_version: "10.12.3",
  version: "10.12.3",
};

export function lookup(
  values: Record<string, string | null | undefined>,
  name: string,
): string | undefined {
  const direct = values[name]?.trim();
  if (direct) return direct;
  const alias = ALIASES[name];
  const aliased = alias ? values[alias]?.trim() : undefined;
  if (aliased) return aliased;
  const reverse = Object.entries(ALIASES).find(([, v]) => v === name)?.[0];
  return reverse ? values[reverse]?.trim() || undefined : undefined;
}

export interface Placeholder {
  name: string;
  fallback: string | null;
  raw: string;
}

export function placeholders(text: string): Placeholder[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) =>
    m[3]
      ? { name: m[3], fallback: DEFAULT_FALLBACKS[m[3]] ?? null, raw: m[0] }
      : {
          name: m[1]!,
          fallback: m[2] === undefined ? null : m[2].trim(),
          raw: `{{${m[1]!}}}`,
        },
  );
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
    .replace(
      PLACEHOLDER,
      (
        _,
        name: string | undefined,
        fallback: string | undefined,
        single: string | undefined,
      ) => {
        const key = (single ?? name)!;
        const value = lookup(values, key);
        if (value) return value;
        if (single && DEFAULT_FALLBACKS[single] !== undefined)
          return DEFAULT_FALLBACKS[single];
        if (!single && fallback !== undefined) return fallback.trim();
        missing.add(key);
        return "";
      },
    )
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
        if (!builtIn && !lookup(known, p.name) && p.fallback === null)
          problems.push({
            language: body.language,
            variant: i,
            problem: `${p.raw} has no value in this app's settings and no fallback`,
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
