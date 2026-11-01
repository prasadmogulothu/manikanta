import { canonicalOrigin, sitemapXml } from '@/lib/seo';
import { getSite } from '@/lib/site';

// ponytail: one page per site today. Add /en here when Phase 2 builds it.
export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getSite(host);
  if (!site) return new Response('Not found', { status: 404 });
  return new Response(sitemapXml(canonicalOrigin(site, host)), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
