export type ProductId = "meta" | "play-reviews" | "business" | "instagram" | "facebook";

export interface Product {
  id: ProductId;
  name: string;
  subdomains: string[];
  home: string;
  landing: string;
  paths: string[];
  soon?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "meta",
    name: "Meta Ads",
    subdomains: ["ads", "metaads"],
    home: "/setup",
    landing: "/meta-ads",
    paths: ["/setup", "/inbox", "/campaigns", "/leads", "/creatives", "/profile", "/reports"],
  },
  {
    id: "play-reviews",
    name: "Play Reviews",
    subdomains: ["playreview", "playreviews"],
    home: "/reviews",
    landing: "/play-reviews",
    paths: ["/reviews", "/store"],
  },
  {
    id: "business",
    name: "Google Business",
    subdomains: ["googlebusiness", "business"],
    home: "/business",
    landing: "/google-business",
    paths: ["/business"],
  },
  {
    id: "instagram",
    name: "Instagram Autopost",
    subdomains: ["instagram", "insta"],
    home: "/instagram",
    landing: "/instagram-autopost",
    paths: ["/instagram"],
  },
  {
    id: "facebook",
    name: "Facebook Autopost",
    subdomains: ["facebook", "fb"],
    home: "/facebook",
    landing: "/facebook-autopost",
    paths: ["/facebook"],
  },
];

export const PUBLIC_PATHS = [
  "/privacy",
  "/terms",
  "/refund-policy",
  "/data-deletion",
  ...PRODUCTS.map((p) => p.landing),
];

export const SHARED_PATHS = [
  "/login",
  "/oauth",
  "/home",
  "/claude",
  "/settings",
  "/kit",
  ...PUBLIC_PATHS,
];

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function productForHost(host: string | null): Product | null {
  const label = host?.split(":")[0]?.split(".")[0]?.toLowerCase();
  if (!label) return null;
  return PRODUCTS.find((p) => p.subdomains.includes(label)) ?? null;
}

export function productForPath(pathname: string): Product | null {
  return PRODUCTS.find((p) => p.paths.some((base) => under(pathname, base))) ?? null;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((base) => under(pathname, base));
}

export function isSharedPath(pathname: string): boolean {
  return SHARED_PATHS.some((base) => under(pathname, base));
}
