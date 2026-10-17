import {
  SVG_FORMATS,
  SvgFormat,
} from "@modules/creatives/domain/creative.rules";

import { BrandKit, DEFAULT_BRAND_KIT, PostFormat } from "./social.types";

const HEX = /^#[0-9a-f]{6}$/i;

const color = (value: string, fallback: string) =>
  HEX.test(value) ? value : fallback;

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const font = (name: string) =>
  `${escape(name.replace(/[^\w\s-]/g, "").slice(0, 40) || "Helvetica")}, Helvetica, Arial, sans-serif`;

export function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,;:!?]?$/, "")}…`;
    return kept;
  }
  return lines;
}

export function svgFormatFor(format: PostFormat): SvgFormat {
  return format === "story" ? "story" : "square";
}

export interface SlideInput {
  headline: string;
  kicker: string;
  footer: string;
  kit: BrandKit;
  format: SvgFormat;
  slide: number;
  slides: number;
}

export function brandSlideSvg(input: SlideInput): string {
  const { width, height } = SVG_FORMATS[input.format];
  const primary = color(
    input.kit.colors.primary,
    DEFAULT_BRAND_KIT.colors.primary,
  );
  const secondary = color(
    input.kit.colors.secondary,
    DEFAULT_BRAND_KIT.colors.secondary,
  );
  const accent = color(
    input.kit.colors.accent,
    DEFAULT_BRAND_KIT.colors.accent,
  );
  const inverted = input.slide % 2 === 1;
  const bg = inverted ? secondary : primary;
  const fg = inverted ? primary : secondary;
  const size = input.format === "story" ? 96 : 84;
  const lines = wrap(input.headline, input.format === "story" ? 16 : 18, 6);
  const top = height / 2 - ((lines.length - 1) * size * 1.15) / 2;
  const pad = 96;
  const heading = font(input.kit.fonts.heading);
  const body = font(input.kit.fonts.body);
  const text = lines
    .map(
      (l, i) =>
        `<text x="${pad}" y="${Math.round(top + i * size * 1.15)}" font-family="${heading}" font-size="${size}" font-weight="700" fill="${fg}">${escape(l)}</text>`,
    )
    .join("");
  const dots =
    input.slides > 1
      ? Array.from(
          { length: input.slides },
          (_, i) =>
            `<circle cx="${width - pad - (input.slides - 1 - i) * 28}" cy="${pad}" r="8" fill="${i === input.slide ? accent : fg}" opacity="${i === input.slide ? 1 : 0.35}"/>`,
        ).join("")
      : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="${bg}"/>`,
    `<circle cx="${width}" cy="${height}" r="${Math.round(width * 0.42)}" fill="${accent}" opacity="0.9"/>`,
    `<rect x="${pad}" y="${pad - 12}" width="120" height="12" rx="6" fill="${accent}"/>`,
    `<text x="${pad}" y="${pad + 60}" font-family="${body}" font-size="34" font-weight="600" letter-spacing="2" fill="${fg}" opacity="0.8">${escape(input.kicker.toUpperCase().slice(0, 40))}</text>`,
    dots,
    text,
    `<text x="${pad}" y="${height - pad}" font-family="${body}" font-size="36" font-weight="600" fill="${fg}">${escape(input.footer.slice(0, 48))}</text>`,
    `</svg>`,
  ].join("");
}

export function slideHeadlines(
  headline: string,
  caption: string,
  cta: string,
  count: number,
): string[] {
  if (count <= 1) return [headline];
  const sentences = caption
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .filter((s) => s.length > 8);
  const middle = Array.from(
    { length: Math.max(0, count - 2) },
    (_, i) => sentences[i] ?? headline,
  );
  return [headline, ...middle, cta || "Follow for more"].slice(0, count);
}
