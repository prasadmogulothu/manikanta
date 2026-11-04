import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer, Header, SkipLink } from '@/chrome/Chrome';
import { getSite } from '@/lib/site';

type Params = { params: Promise<{ host: string }> };

// Only for a site that may take orders: it says what an order keeps and who sees it.
// Every name and number comes from the site's config.
const TEXT = {
  te: {
    title: 'గోప్యతా విధానం',
    body: (shop: string, phone: string) => [
      `ఈ వెబ్‌సైట్‌లో మీరు ఆర్డర్ చేసినప్పుడు మీ పేరు, మొబైల్ నంబర్, చిరునామా, మీరు ఎంచుకున్న వస్తువులు ${shop} వారి ఆర్డర్ రికార్డుల్లో భద్రపరచబడతాయి.`,
      'ఈ వివరాలు మీ ఆర్డర్ అందించడానికి, అవసరమైతే మిమ్మల్ని సంప్రదించడానికి మాత్రమే. షాపు యజమాని, వారి సిబ్బంది మాత్రమే వీటిని చూస్తారు. వీటిని ఎవరికీ అమ్మము, ఇవ్వము.',
      'మీరు WhatsAppలో Send నొక్కినప్పుడు ఆర్డర్ మీ WhatsApp నుంచి షాపు నంబర్‌కు వెళ్తుంది.',
      'నకిలీ ఆర్డర్లను ఆపడానికి, ఆర్డర్ వచ్చిన ఇంటర్నెట్ కనెక్షన్ చిరునామా (IP) కూడా నమోదవుతుంది.',
      'మళ్ళీ టైప్ చేయనవసరం లేకుండా మీ కార్ట్, మీ వివరాలు మీ ఫోన్ బ్రౌజర్‌లోనే ఉంటాయి. బ్రౌజర్ డేటా తొలగిస్తే అవి పోతాయి.',
      phone ? `మీ వివరాలు మార్చాలన్నా, తొలగించాలన్నా షాపుకు ఫోన్ చేయండి: ${phone}.` : 'మీ వివరాలు మార్చాలన్నా, తొలగించాలన్నా షాపును సంప్రదించండి.',
    ],
  },
  en: {
    title: 'Privacy',
    body: (shop: string, phone: string) => [
      `When you place an order on this website, your name, mobile number, address and the items you chose are saved in ${shop}'s order records.`,
      'They are used only to deliver your order and to contact you about it. Only the shop owner and their staff see them. They are never sold or shared.',
      'When you tap Send on WhatsApp, the order goes from your own WhatsApp to the shop’s number.',
      'To stop fake orders, the internet address (IP) an order came from is recorded too.',
      'So you don’t have to type them again, your cart and your details stay in your phone’s browser. Clearing the browser’s data removes them.',
      phone ? `To change or delete your details, call the shop: ${phone}.` : 'To change or delete your details, contact the shop.',
    ],
  },
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSite((await params).host);
  return { title: `${TEXT.en.title} · ${site?.config.brand?.name || site?.name || ''}`, alternates: { canonical: '/privacy' } };
}

export default async function Privacy({ params }: Params) {
  const site = await getSite((await params).host);
  if (!site || site.config.features?.orders !== true) notFound();

  const shop = site.config.brand?.name || site.name;
  const phone = site.config.contact?.phone_display || site.config.contact?.phone || '';
  // The site's own language first, then English for everyone else.
  const langs = site.config.lang === 'te' ? [TEXT.te, TEXT.en] : [TEXT.en];
  return (
    <>
      <SkipLink site={site} />
      <Header site={site} home="/" />
      <main id="main" className="sec">
        <div className="wrap privacy">
          {langs.map((t) => (
            <section key={t.title}>
              <h1>{t.title}</h1>
              {t.body(shop, phone).map((p) => <p key={p}>{p}</p>)}
            </section>
          ))}
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
