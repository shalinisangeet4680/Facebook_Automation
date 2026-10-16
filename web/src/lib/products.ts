export type ProductId = "meta" | "play-reviews" | "business";

export interface Product {
  id: ProductId;
  name: string;
  subdomains: string[];
  home: string;
  paths: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: "meta",
    name: "Meta Ads",
    subdomains: ["ads", "metaads"],
    home: "/setup",
    paths: ["/setup", "/inbox", "/campaigns", "/creatives", "/profile", "/reports"],
  },
  {
    id: "play-reviews",
    name: "Play Reviews",
    subdomains: ["playreview", "playreviews"],
    home: "/reviews",
    paths: ["/reviews", "/store"],
  },
  {
    id: "business",
    name: "Google Business",
    subdomains: ["googlebusiness", "business"],
    home: "/business",
    paths: ["/business"],
  },
];

export const SHARED_PATHS = ["/login", "/oauth", "/claude", "/settings", "/kit"];

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

export function isSharedPath(pathname: string): boolean {
  return SHARED_PATHS.some((base) => under(pathname, base));
}
