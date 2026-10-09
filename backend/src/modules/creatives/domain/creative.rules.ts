export const CREATIVE_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_SVG_BYTES = 400 * 1024;

export const SVG_FORMATS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 628 },
  logo: { width: 720, height: 720 },
  facebook_cover: { width: 1640, height: 624 },
} as const;

export type SvgFormat = keyof typeof SVG_FORMATS;

export function sanitizeSvg(svg: string): string | null {
  const trimmed = svg.trim();
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(trimmed)) return null;
  if (/<script|<foreignObject|\son[a-z]+\s*=/i.test(trimmed)) return null;
  if (/(href|src)\s*=\s*["'](?!#|data:image\/)/i.test(trimmed)) return null;
  return trimmed;
}
