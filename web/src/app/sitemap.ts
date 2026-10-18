import type { MetadataRoute } from "next";

import { CATALOG } from "@/features/products/catalog";
import { SITE_URL } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const legal = ["privacy", "terms", "refund-policy"];
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...CATALOG.flatMap((p) => [
      { url: `${SITE_URL}/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.9 },
      ...legal.map((l) => ({
        url: `${SITE_URL}/${p.slug}/${l}`,
        changeFrequency: "yearly" as const,
        priority: 0.3,
      })),
    ]),
    ...[...legal, "data-deletion"].map((l) => ({
      url: `${SITE_URL}/${l}`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}
