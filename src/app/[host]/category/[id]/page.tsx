import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Cart from '@/chrome/Cart';
import { Footer, Header, SkipLink } from '@/chrome/Chrome';
import { categories, categoryName as nameOf } from '@/lib/links';
import { ordersOn } from '@/lib/orders';
import { getSite } from '@/lib/site';
import type { Site } from '@/lib/types';
import Services from '@/modules/Services';

type Params = { params: Promise<{ host: string; id: string }> };

const find = (site: Site | null, id: string) => (site ? categories(site.config).find((s) => s.config.id === decodeURIComponent(id)) : undefined);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host, id } = await params;
  const site = await getSite(host);
  const s = find(site, id);
  return s ? { title: `${nameOf(s)} · ${site!.config.brand?.name || site!.name}`, alternates: { canonical: `/category/${s.config.id}` } } : {};
}

// One category with every product, and links to the others so the whole catalog is a tap away.
export default async function Category({ params }: Params) {
  const { host, id } = await params;
  const site = await getSite(host);
  const s = find(site, id);
  if (!site || !s) notFound();

  return (
    <>
      <SkipLink site={site} />
      <Header site={site} home="/" />
      <main id="main">
        <nav className="wrap cat-nav" aria-label="Categories">
          <a href="/categories">All categories</a>
          {categories(site.config).map((x) => (
            <a key={x.config.id} href={`/category/${encodeURIComponent(x.config.id)}`} aria-current={x === s ? 'page' : undefined}>{nameOf(x)}</a>
          ))}
        </nav>
        <Services c={{ ...s.config, alt: false }} site={site} />
      </main>
      <Footer site={site} />
      {ordersOn(site.config) && <Cart site={site} />}
    </>
  );
}
