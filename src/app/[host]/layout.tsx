import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { asset } from '@/lib/links';
import { canonicalOrigin, shareImage } from '@/lib/seo';
import { getSite } from '@/lib/site';
import { composeCss, fontHref } from '@/lib/theme';
import '@/themes/base.css';

type Params = { params: Promise<{ host: string }> };

// None at build time: each site's page is built on its first visit, then cached.
export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host } = await params;
  const site = await getSite(host);
  if (!site) return {};
  const { seo = {}, brand = {} } = site.config;
  const title = seo.title || site.name;
  const image = shareImage(site.config);
  return {
    metadataBase: new URL(canonicalOrigin(site, host)),
    title,
    description: seo.description,
    alternates: { canonical: '/' },
    icons: brand.favicon ? { icon: asset(brand.favicon) } : undefined,
    openGraph: {
      type: 'website',
      url: '/',
      siteName: brand.name || site.name,
      title,
      description: seo.description,
      images: image ? [{ url: asset(image) }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description: seo.description },
  };
}

export async function generateViewport({ params }: Params): Promise<Viewport> {
  const site = await getSite((await params).host);
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: site?.template.tokens.accent,
  };
}

export default async function SiteLayout({ children, params }: Params & { children: ReactNode }) {
  const site = await getSite((await params).host);
  const overrides = site?.config.theme;
  const fonts = site && fontHref({ ...site.template.tokens, ...overrides });
  return (
    <html lang={site?.config.lang || 'en'}>
      <head>
        {fonts && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={fonts} />
          </>
        )}
        {site && <style dangerouslySetInnerHTML={{ __html: composeCss(site.template, overrides) }} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
