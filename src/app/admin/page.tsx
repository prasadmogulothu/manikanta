import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AdminApp from '@/admin/App';
import { asset, hostFromHeader } from '@/lib/links';
import { getSite } from '@/lib/site';
import { fontHref, toVars } from '@/lib/theme';

const currentSite = async () => getSite(hostFromHeader((await headers()).get('host')));

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite();
  const brand = site?.config.brand;
  return {
    title: `Admin · ${brand?.name || site?.name || ''}`,
    icons: brand?.favicon ? { icon: asset(brand.favicon) } : undefined,
  };
}

// The site's own logo, name, fonts and colours, so the admin reads as part of the shop.
export default async function AdminPage() {
  const site = await currentSite();
  if (!site) notFound();
  const tokens = { ...site.template.tokens, ...site.config.theme };
  const fonts = fontHref(tokens);
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} precedence="default" />}
      <style dangerouslySetInnerHTML={{ __html: `:root{${toVars(tokens)}}` }} />
      <AdminApp brand={site.config.brand} name={site.name} />
    </>
  );
}
