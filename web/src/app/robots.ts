import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/oauth/",
        ...[
          "home",
          "settings",
          "claude",
          "setup",
          "inbox",
          "campaigns",
          "leads",
          "creatives",
          "profile",
          "reports",
          "reviews",
          "store",
          "business",
          "instagram",
          "facebook",
        ].flatMap((p) => [`/${p}$`, `/${p}/`]),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
