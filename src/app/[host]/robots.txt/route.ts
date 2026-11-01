import { canonicalOrigin, robotsTxt } from '@/lib/seo';
import { getSite } from '@/lib/site';

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getSite(host);
  if (!site) return new Response('Not found', { status: 404 });
  return new Response(robotsTxt(canonicalOrigin(site, host)), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
