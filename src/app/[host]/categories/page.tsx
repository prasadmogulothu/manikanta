import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Cart from '@/chrome/Cart';
import { Footer, Header, SkipLink } from '@/chrome/Chrome';
import { asset, categories, categoryName as nameOf } from '@/lib/links';
import { ordersOn } from '@/lib/orders';
import { getSite } from '@/lib/site';

type Params = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSite((await params).host);
  return { title: `All categories · ${site?.config.brand?.name || site?.name || ''}`, alternates: { canonical: '/categories' } };
}

// The whole catalog at a glance: one tile per category, each opening its page.
export default async function Categories({ params }: Params) {
  const site = await getSite((await params).host);
  const cats = site ? categories(site.config) : [];
  if (!site || cats.length === 0) notFound();

  return (
    <>
      <SkipLink site={site} />
      <Header site={site} home="/" />
      <main id="main" className="sec">
        <div className="wrap">
          <div className="sec-head"><h1 className="sec-title">All categories</h1></div>
          <div className="cards cat-tiles" style={{ '--cols': 3 } as React.CSSProperties}>
            {cats.map((s) => {
              const items = (s.config.items || []).filter((it: any) => it.enabled !== false);
              const photo = items.find((it: any) => it.image);
              return (
                <a className="card" key={s.config.id} href={`/category/${encodeURIComponent(s.config.id)}`}>
                  {photo && <figure><img src={asset(photo.image)} alt="" loading="lazy" /></figure>}
                  <h3>{nameOf(s)}</h3>
                  {s.config.heading && s.config.heading_2 && <p className="t2">{s.config.heading_2}</p>}
                  <p>{items.length} products →</p>
                </a>
              );
            })}
          </div>
        </div>
      </main>
      <Footer site={site} />
      {ordersOn(site.config) && <Cart site={site} />}
    </>
  );
}
