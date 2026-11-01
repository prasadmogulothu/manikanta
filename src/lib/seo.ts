// What search engines and link previews read. Pure, so scripts/modules.check.mjs can test it.

type SiteLike = { hostnames?: string[]; config?: Record<string, any> };

// One address per site in search results, whichever one a visitor came through.
export const canonicalOrigin = (site: SiteLike, fallbackHost: string) => `https://${site.hostnames?.[0] || fallbackHost}`;

// /admin isn't blocked here on purpose: a crawler has to reach it to read its noindex tag.
export const robotsTxt = (origin: string) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;

export const sitemapXml = (origin: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`;

// The owner's chosen share image, else the first thing on the page that shows the business.
export function shareImage(config: Record<string, any> = {}): string | undefined {
  const hero = (config.sections || []).find((s: any) => s.type === 'hero' && s.enabled !== false);
  return config.seo?.image || hero?.config?.image || config.brand?.logo || undefined;
}
