import { notFound } from 'next/navigation';
import { getPage } from '@/lib/site';
import { Footer, Header, SkipLink } from '@/chrome/Chrome';
import { MODULES } from '@/modules/registry';

export default async function Home({ params }: { params: Promise<{ host: string; lang?: string[] }> }) {
  const { host, lang } = await params;
  const found = await getPage(host, lang);
  if (!found) notFound();
  const { site, page } = found;

  const sections = (site.config.sections || []).filter((s: any) => s.enabled !== false);
  return (
    <>
      <SkipLink site={site} />
      <Header site={site} other={page.other} />
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
    </>
  );
}
