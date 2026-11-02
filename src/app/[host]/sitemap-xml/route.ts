import { canonicalOrigin, sitemapXml } from '@/lib/seo';
import { getSite } from '@/lib/site';

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getSite(host);
  if (!site) return new Response('Not found', { status: 404 });
  return new Response(sitemapXml(canonicalOrigin(site, host), site.config.lang_2 ? ['/', `/${site.config.lang_2}`] : ['/']), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
