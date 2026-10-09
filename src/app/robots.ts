import type { MetadataRoute } from "next";

const PRODUCTION_URL = "https://app.kanzlei-brands.de";

/**
 * Next.js-eigene robots.txt - erlaubt den öffentlichen Blog, sperrt aber
 * explizit /dashboard und /api (internes Tool, keine Suchmaschinen-Indexierung).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/blog", disallow: ["/dashboard", "/api"] },
    sitemap: `${PRODUCTION_URL}/sitemap.xml`,
  };
}
