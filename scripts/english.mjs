// Phase 2 English: Claude's draft, for the owner to approve (dynamic-admin-page.md §5).
// Fills only empty fields, so the owner's own edits always win, and running it twice
// changes nothing. Saves with a version snapshot, so History can undo it.
//   npm run english            the Neon dev branch
//   npm run english -- --prod  production. Then save once in /admin to refresh the cache.
// ponytail: one-off. Delete once production has it.
import { readFileSync } from 'node:fs';
import { Client } from '@neondatabase/serverless';

const SLUG = 'manikantanaturals';

const SITE = {
  brand: { name_2: 'Manikanta Naturals', wordmark_2: 'Manikanta', wordmark_accent_2: 'Naturals' },
  contact: { whatsapp_text_2: 'Hello, Manikanta Naturals' },
  footer: { note_2: 'The best natural and Ayurvedic products for all our friends, at low prices.' },
  seo: {
    title_2: 'Manikanta Naturals, Kollapur — Organic, Millets & Ayurveda',
    description_2:
      'Manikanta Naturals, Kollapur — organic produce, millets, Ayurvedic and cow-based products. Natural • Pure • Healthy. Ph: 95816 17244.',
  },
};
const NAV = { '#millets': 'Millets', '#organic': 'Organic', '#dryfruits': 'Dry Fruits', '#about': 'About Us', '#contact': 'Address' };
const HOURS = { 'మరో నంబర్': 'Another number' };

// heading_2 becomes the short English title. Today's English sentence there moves to
// sub_2, and `sub` is the Telugu intro for sections that had none.
const SECTIONS = {
  millets: { heading_2: 'Millets' },
  'millet-foods': { heading_2: 'Millet Foods', sub: 'రవ్వ, స్నాక్స్, కుకీస్, చిక్కీలు — అన్నీ సిరిధాన్యాలతో తయారైనవి.' },
  benefits: { heading_2: 'Eat millets… live healthy!' },
  organic: { heading_2: 'Pure Organic Products' },
  dryfruits: { heading_2: 'Dry Fruits & Traditional Sweets', sub: 'స్వచ్ఛమైన నెయ్యి, బెల్లం, డ్రై ఫ్రూట్స్‌తో చేసిన సంప్రదాయ స్వీట్స్.' },
  ayurveda: { heading_2: 'Ayurvedic & Cow-based Products', sub: 'ఇంటికి, ఆరోగ్యానికి ఆయుర్వేద మరియు గో ఆధారిత ఉత్పత్తులు.' },
  about: { portrait_alt_2: 'Proprietor Mahesh Kashipuram', seal: { label_2: 'Natural' } },
  gallery: { heading_2: 'Latest News', sub: 'మా తాజా ప్రకటనలు, కొత్త స్టాక్ వివరాలు.' },
  contact: { heading_2: 'Our Address', sub: 'కొల్లాపూర్‌లోని మా స్టోర్‌కు రండి.' },
};
const HERO = {
  heading_2: 'From nature… to better health',
  sub_2:
    'Organic produce grown naturally in the hills without any chemicals, millets, Ayurvedic and cow-based products — all in one place in Kollapur.',
  image_alt_2: 'The Manikanta Naturals store in Kollapur',
};
const CTAS = { call: 'Call us', whatsapp: 'Ask on WhatsApp' };
const STATS = { ఆర్గానిక్: 'Organic', 'రకాల సిరిధాన్యాలు': 'Kinds of millets', కల్తీ: 'Adulteration' };

// Products by photo, which neither language's edits change.
const p = (f) => `${SLUG}/${f}.webp`;
const PRODUCTS = {
  [p('prod-multi-millet-idli-rava')]: { body_2: 'Millet rava for soft idlis.' },
  [p('prod-multi-millet-upma-rava')]: { body_2: 'For a healthy breakfast.' },
  [p('prod-millet-masala-snacks')]: { body_2: 'Not fried.' },
  [p('prod-millet-chikkies')]: { body_2: 'A healthy sweet for children and adults.' },
  [p('prod-millet-cookies-nava-grain')]: { body_2: 'Crunchy cookies made with nine grains.' },
  [p('prod-millet-cookies-rusk')]: { body_2: 'A healthy rusk to go with your tea.' },
  [p('prod-organic-pasupu')]: { body_2: 'With its natural colour and aroma.' },
  [p('prod-organic-karam')]: { body_2: 'Strong flavour, with no adulteration.' },
  [p('prod-organic-nalla-uluvalu')]: { body_2: 'A storehouse of nutrients for good health.' },
  [p('prod-organic-pottu-minapappu')]: { body_2: 'Traditional taste and strength.' },
  [p('prod-konda-kandi-pappu')]: { body_2: 'Village purity, with no adulteration.' },
  [p('prod-organic-visirina-kandipappu')]: { body_2: 'Traditional toor dal, ground on a hand-turned stone mill.' },
  [p('prod-organic-nalla-pebbarlu')]: { body_2: 'Protein that does the body a lot of good.' },
  [p('p-rajma')]: { body_2: 'Great taste, great health.' },
  [p('prod-organic-bellam-podi')]: { body_2: 'Natural sweetness in place of sugar.' },
  [p('prod-organic-brown-sugar')]: { body_2: 'Natural, unrefined sugar.' },
  [p('prod-atreyapuram-putharekulu')]: { body_2: 'Made with pure ghee, jaggery and dry fruits.', price_2: 'Only ₹99' },
  [p('prod-ippa-puvvu-laddu')]: { body_2: "Nature's nectar — builds immunity and gives the body instant energy." },
  [p('prod-nasika')]: {
    body_2:
      'Nasal drops made with cow-based panchagavya. Used in traditional Ayurveda for headaches, colds, sinus trouble and sleeplessness. 100% natural · safe.',
    price_2: 'Consult a doctor before use',
    alt_2: 'Saraswati Nasika bottle',
  },
  [p('prod-gangigovu-citrus-bioengyme')]: {
    body_2:
      'A natural dish wash made with lemon bio-enzyme, jaggery, soapnut and herbal extracts. A fresh shine for your kitchen vessels, from nature — goodbye to chemical dish washes!',
    alt_2: 'Gangigovu citrus bio-enzyme dish wash bottle',
  },
  [p('prod-goshala-handwash')]: { body_2: 'A natural liquid hand wash made with neem and panchagavya. Cleans hands gently and safely.' },
  [p('prod-organic-ultrasoft-toothbrush')]: {
    body_2: 'An ultra-soft toothbrush made of bamboo that breaks down in soil. Goodbye to plastic brushes!',
  },
  [p('prod-vattiveru-made-scrub')]: { body_2: 'A bath scrub woven from natural vetiver root — cooling for the skin, with a pleasant scent.' },
};
const FLYERS = {
  [p('prod-pooja-samgri-flyer')]: 'Flyer: premium natural pooja items at Manikanta Naturals',
  [p('prod-millets-snacks-flyer')]: 'Flyer: millet biscuits, chips, rusks, noodles and semiya',
  [p('prod-new-flyer-atreyapuram-putharekulu')]: 'Flyer: Atreyapuram special putharekulu, ₹99',
  [p('prod-new-flyer-ippa-puvvu-laddu')]: 'Flyer: Ippa puvvu laddu',
  [p('flyer-millets')]: 'Flyer: new stock of millets',
  [p('flyer-banner')]: 'Manikanta Naturals banner — Mahesh Kashipuram',
  [p('flyer-organic')]: 'Flyer: 100% organic products',
  [p('flyer-dishwash')]: 'Flyer: Gangigovu citrus bio-enzyme dish wash',
  [p('flyer-nasika')]: 'Flyer: Panchagavya Nasika',
  [p('dussehra-wishes')]: 'Manikanta Naturals wishes you and your family a happy Vijayadashami',
};

// The English line under each heading as seeded. Only that is moved to sub_2, so a title
// the owner typed is left alone.
const seeded = JSON.parse(readFileSync(new URL('../site.json', import.meta.url), 'utf8')).config.sections;
const wasSeeded = (c) => seeded.some((s) => s.type === c.type && s.config.id === c.config.id && s.config.heading_2 === c.config.heading_2);

const empty = (v) => typeof v !== 'string' || !v.trim();
let filled = 0;
function fill(target, values) {
  if (!target) return;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'object') fill(target[k], v);
    else if (v && empty(target[k])) (target[k] = v), filled++;
  }
}

export function addEnglish(config) {
  for (const [k, v] of Object.entries(SITE)) fill(config[k], v);
  for (const n of config.nav || []) if (NAV[n.href]) fill(n, { label_2: NAV[n.href] });
  for (const h of config.contact?.hours || []) if (HOURS[h.label]) fill(h, { label_2: HOURS[h.label] });
  for (const section of config.sections || []) {
    const { type, config: c } = section;
    const moveLine = c?.heading_2 && empty(c.sub_2) && wasSeeded(section) && (type === 'hero' || SECTIONS[c.id]?.heading_2);
    if (type === 'hero') {
      // Today's English line under the heading is a tagline; it gives way to the translation.
      if (moveLine) c.heading_2 = '';
      fill(c, HERO);
      for (const b of c.ctas || []) if (CTAS[b.action]) fill(b, { label_2: CTAS[b.action] });
    }
    const s = SECTIONS[c?.id];
    if (!s) continue;
    if (moveLine) (c.sub_2 = c.heading_2), (c.heading_2 = ''), filled++;
    fill(c, s);
    for (const st of c.stats || []) if (STATS[st.label]) fill(st, { label_2: STATS[st.label] });
    for (const it of c.items || []) fill(it, PRODUCTS[it.image] || {});
    for (const f of c.images || []) if (typeof f === 'object') fill(f, { alt_2: FLYERS[f.src] });
  }
  return filled;
}

const prod = process.argv.includes('--prod');
const url = prod ? process.env.DATABASE_URL_OWNER : process.env.DATABASE_URL_OWNER_DEV;
if (!prod && new URL(url).hostname === new URL(process.env.DATABASE_URL_OWNER).hostname) throw new Error('The dev URL is production.');
const db = new Client(url);
await db.connect();
try {
  const { rows } = await db.query('select id, config, version from hh_sites where slug = $1', [SLUG]);
  const { id, config, version } = rows[0];
  const n = addEnglish(config);
  if (!n) console.log('Nothing to add.');
  else {
    // Same statement as saveContent in src/lib/db.ts, so the snapshot and save can't come apart.
    const saved = await db.query(
      `with up as (update hh_sites set config = $2, version = version + 1, updated_at = now()
                    where id = $1 and version = $3 returning id, config, version),
            snap as (insert into hh_site_versions (site_id, config, saved_by) select id, config, 'english-draft' from up)
       select version from up`,
      [id, JSON.stringify(config), version],
    );
    if (!saved.rows[0]) throw new Error('Someone saved meanwhile. Run it again.');
    console.log(`${prod ? 'Production' : 'Dev'}: ${n} fields filled, version ${saved.rows[0].version}`);
  }
} finally {
  await db.end();
}
