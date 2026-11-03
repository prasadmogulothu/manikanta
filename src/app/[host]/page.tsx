import { notFound } from 'next/navigation';
import { getSite } from '@/lib/site';
import Cart from '@/chrome/Cart';
import { Footer, Header, SkipLink } from '@/chrome/Chrome';
import { ordersOn } from '@/lib/orders';
import { MODULES } from '@/modules/registry';

export default async function Home({ params }: { params: Promise<{ host: string }> }) {
  const site = await getSite((await params).host);
  if (!site) notFound();

  const sections = (site.config.sections || []).filter((s: any) => s.enabled !== false);
  return (
    <>
      <SkipLink site={site} />
      <Header site={site} />
      <main id="main">
        {sections.map((s: any, i: number) => {
          const mod = MODULES[s.type];
          // An unknown type means the config outran this deploy. Render the rest.
          if (!mod) return null;
          // Bands alternate unless the section pins it in config.
          const c = { ...s.config, alt: s.config?.alt ?? i % 2 === 1 };
          return <mod.Component key={`${s.type}-${i}`} c={c} site={site} />;
        })}
      </main>
      <Footer site={site} />
      {ordersOn(site.config) && <Cart site={site} />}
    </>
  );
}
