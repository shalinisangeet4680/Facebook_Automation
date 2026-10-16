export const STORE_STYLES = ["callouts", "light", "bold", "minimal"] as const;
export const FEATURE_STYLES = ["dark", "bold"] as const;
export const STORE_SIZES = ["phone", "tablet7", "tablet10"] as const;
export const ASSET_KINDS = [
  "screen",
  "preview",
  "screenshot",
  "feature_graphic",
] as const;
export const PROJECT_STATUSES = [
  "draft",
  "choosing",
  "style_chosen",
  "rendered",
] as const;

export type StoreStyle = (typeof STORE_STYLES)[number];
export type StoreSize = (typeof STORE_SIZES)[number];
export type AssetKind = (typeof ASSET_KINDS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STORE_IMAGE_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const UPLOAD_TOKEN_TTL_SECONDS = 2 * 60 * 60;
export const MAX_ASSET_BYTES = 15 * 1024 * 1024;
export const MAX_ASSETS_PER_PROJECT = 800;
export const MAX_LANGUAGES = 20;

export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const NAME = /^[A-Za-z0-9_-]{1,64}$/;
export const LANG = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

export interface AssetMeta {
  kind: AssetKind;
  name: string;
  style: string;
  lang: string;
  size: string;
}

export function assetProblem(meta: AssetMeta): string | null {
  if (!NAME.test(meta.name))
    return "name must be 1 to 64 letters, digits, - or _";
  if (meta.lang && !LANG.test(meta.lang))
    return "lang must be a language code like en or pt-BR";
  switch (meta.kind) {
    case "screen":
      return meta.style || meta.lang || meta.size
        ? "screens take only a name"
        : null;
    case "feature_graphic":
      return (FEATURE_STYLES as readonly string[]).includes(meta.style) &&
        !meta.lang &&
        !meta.size
        ? null
        : `feature graphics need style ${FEATURE_STYLES.join(" or ")} and no lang or size`;
    case "preview":
    case "screenshot":
      if (!(STORE_STYLES as readonly string[]).includes(meta.style))
        return `style must be one of ${STORE_STYLES.join(", ")}`;
      if (!(STORE_SIZES as readonly string[]).includes(meta.size))
        return `size must be one of ${STORE_SIZES.join(", ")}`;
      return meta.lang ? null : "lang is required";
  }
}

export function statusAfterUpload(
  current: ProjectStatus,
  kind: AssetKind,
): ProjectStatus {
  if (kind === "screenshot" || kind === "feature_graphic") return "rendered";
  if (kind === "preview" && current === "draft") return "choosing";
  return current;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function creativeName(
  project: string,
  asset: { name: string; style: string; lang: string; size: string },
): string {
  const detail = [asset.style, asset.lang, asset.size]
    .filter(Boolean)
    .join(", ");
  return `${project} · ${asset.name}${detail ? ` (${detail})` : ""}`.slice(
    0,
    120,
  );
}
