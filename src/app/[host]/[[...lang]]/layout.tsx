import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { asset } from '@/lib/links';
import { canonicalOrigin, shareImage } from '@/lib/seo';
import { getPage, getSite } from '@/lib/site';
import { composeCss, fontHref } from '@/lib/theme';
import '@/themes/base.css';

// `/` is the main language and `/<lang_2>` the second, so `lang` is empty or one segment.
type Params = { params: Promise<{ host: string; lang?: string[] }> };

// None at build time: each site's page is built on its first visit, then cached.
export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host, lang } = await params;
  const found = await getPage(host, lang);
  if (!found) return {};
  const { site, page } = found;
  const { seo = {}, brand = {} } = site.config;
  const title = seo.title || site.name;
  const image = shareImage(site.config);
  const main = page.path === '/' ? page : page.other!;
  return {
    metadataBase: new URL(canonicalOrigin(site, host)),
    title,
    description: seo.description,
    alternates: {
      canonical: page.path,
      languages: page.other && {
        [page.lang]: page.path,
        [page.other.lang]: page.other.path,
        'x-default': main.path,
      },
    },
    icons: brand.favicon ? { icon: asset(brand.favicon) } : undefined,
    openGraph: {
      type: 'website',
      url: page.path,
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
  const { host, lang } = await params;
  const found = await getPage(host, lang);
  const site = found?.site;
  const overrides = site?.config.theme;
  const fonts = site && fontHref({ ...site.template.tokens, ...overrides });
  return (
    <html lang={found?.page.lang || 'en'}>
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
