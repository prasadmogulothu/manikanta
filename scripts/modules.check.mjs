// The module contract: reusable outside Next.js, no site wording in src/, every
// declared class styled, and unsafe links dropped.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ContentError, MAX_CONTENT_BYTES, prepareContent } from '../src/lib/content.ts';
import { asset, ctaHref, safeHref, safeMapUrl, visibleNav } from '../src/lib/links.ts';
import { isFixedLink, orderMenu, setInMenu } from '../src/admin/menu.ts';
import { canonicalOrigin, robotsTxt, shareImage, sitemapXml } from '../src/lib/seo.ts';
import { toVars } from '../src/lib/theme.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../src/lib/password.ts';
import { ASPECTS, ZOOM_MAX, ZOOM_MIN, clampZoom, cropBox, dragged } from '../src/admin/crop.ts';
import { allowedType, bytesMatchKey, keyFor, ownsKey } from '../src/lib/uploads.ts';
import { OrderError, cleanPhone, orderMessage, ordersOn, packsOf, prepareOrder } from '../src/lib/orders.ts';
import { ASSIGNABLE_CAPS, cleanUsername, validCaps, validPassword, validRoleIds, validUserId } from '../src/lib/users.ts';

const path = (f) => new URL(`../src/${f}`, import.meta.url);
const read = (f) => readFileSync(path(f), 'utf8');
const base = read('themes/base.css');
const modules = readdirSync(path('modules')).filter((f) => f.endsWith('.tsx')).map((f) => `modules/${f}`);

for (const f of [...modules, 'chrome/Chrome.tsx', 'modules/registry.ts']) {
  const src = read(f);
  assert.ok(!/from ['"]next[/'"]/.test(src), `${f} must not import next/*`);
  assert.ok(!/\.css['"]/.test(src), `${f} must not import CSS`);
  for (const [, style] of src.matchAll(/style=\{([^\n]*)\n?/g)) {
    assert.ok(style.includes("'--"), `${f}: only pass-through variables may be inline styles`);
  }
  const list = src.match(/export const classes = \[([\s\S]*?)\]/);
  if (f.startsWith('modules/') && !/icons|Section|registry/.test(f)) assert.ok(list, `${f} declares no classes`);
  for (const [, cls] of (list?.[1] ?? '').matchAll(/'([^']+)'/g)) {
    assert.ok(base.includes(`.${cls}`), `${f}: .${cls} has no rule in base.css`);
  }
}

for (const f of readdirSync(path(''), { recursive: true }).filter((f) => /\.tsx?$/.test(f))) {
  assert.ok(!/manikanta|మణికంఠ|95816/i.test(read(f)), `${f} contains site-specific wording`);
}

for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x', 5]) {
  assert.equal(safeHref(bad), undefined, `safeHref let through ${bad}`);
}
for (const good of ['https://a.com', 'tel:+911', '#x', '/en', 'mailto:a@b.c']) assert.equal(safeHref(good), good);

const MAP = 'https://maps.google.com/maps?q=1,2&output=embed';
assert.equal(safeMapUrl(MAP), MAP);
assert.ok(safeMapUrl('https://www.google.com/maps/embed?pb=1'));
for (const bad of ['https://evil.com/maps', 'http://maps.google.com/x', 'https://www.google.com/search', 'https://maps.google.com.evil.com/', 'javascript:x']) {
  assert.equal(safeMapUrl(bad), undefined, `safeMapUrl let through ${bad}`);
}

const contact = { phone: '+911', whatsapp: '+91 22', whatsapp_text: 'a b' };
assert.equal(ctaHref({ action: 'call' }, contact), 'tel:+911');
assert.equal(ctaHref({ action: 'whatsapp' }, contact), 'https://wa.me/9122?text=a%20b');
assert.equal(ctaHref({ href: 'javascript:x' }, contact), undefined);
assert.equal(asset('https://a.com/x.png'), 'https://a.com/x.png');

// One forgotten check must fail the build, not expose a shop.
const PUBLIC_ROUTES = ['app/api/v1/auth/login/route.ts'];
const routes = readdirSync(path('app/api'), { recursive: true })
  .filter((f) => /route\.ts$/.test(f))
  .map((f) => `app/api/${f.replaceAll('\\', '/')}`);
assert.ok(routes.length >= 7, 'no API routes found, so the check below proves nothing');
for (const f of routes) {
  if (PUBLIC_ROUTES.includes(f)) continue;
  const src = read(f);
  assert.ok(!/export\s+(async\s+)?function\s/.test(src), `${f}: export handlers through withAuth`);
  const exported = [...src.matchAll(/export\s+const\s+(\w+)\s*=\s*([^\n]*)/g)];
  assert.ok(exported.length, `${f} exports no handlers`);
  for (const [, name, value] of exported) {
    assert.ok(/^withAuth\b/.test(value), `${f}: ${name} must use withAuth`);
  }
}
for (const f of ['lib/db.ts', 'lib/auth.ts']) {
  assert.ok(!/\bsearchParams\b|site_id\s*[:=]\s*body/.test(read(f)), `${f} must not read a site from the request`);
}

const current = {
  theme: { a: 1 },
  tracking: { enabled: false },
  footer: { note: 'old', powered_by: 'HH', powered_by_url: 'https://hh.example' },
};
const saved = prepareContent(current, {
  theme: { a: 2 },
  tracking: { enabled: true },
  site_id: 'other',
  footer: { note: 'new', powered_by: 'Evil', powered_by_logo: 'x.png' },
  sections: [],
});
assert.deepEqual(saved.theme, { a: 1 }, 'theme stays');
assert.deepEqual(saved.tracking, { enabled: false }, 'tracking stays');
assert.deepEqual(saved.footer, { note: 'new', powered_by: 'HH', powered_by_url: 'https://hh.example' }, 'credit stays');
assert.ok(!('theme' in prepareContent({}, { theme: { a: 2 } })), "owner can't add a theme");
for (const bad of [null, [], 'x', 5, { sections: 'x' }, { big: 'x'.repeat(MAX_CONTENT_BYTES) }]) {
  assert.throws(() => prepareContent({}, bad), ContentError);
}
const flyers = (...popups) => ({ sections: [{ type: 'gallery', config: { images: popups.map((popup) => ({ popup })) } }] });
assert.throws(() => prepareContent({}, flyers(true, true)), /Only one flyer/);
assert.ok(prepareContent({}, flyers(true, false)));

const stored = await hashPassword('correct horse');
assert.ok(stored.startsWith('scrypt$') && !stored.includes('correct'));
assert.notEqual(stored, await hashPassword('correct horse'), 'each password gets its own salt');
assert.equal(await verifyPassword('correct horse', stored), true);
assert.equal(await verifyPassword('wrong', stored), false);
assert.equal(await verifyPassword('anything', DUMMY_HASH), false);

// Crop: the window stays inside the photo, never upscales, and the shape is honoured.
const NONE = { aspect: null, zoom: 1, x: 0.5, y: 0.5 };
assert.deepEqual(cropBox(4000, 3000, NONE, 640), { sx: 0, sy: 0, sw: 4000, sh: 3000, dw: 640, dh: 480 });
assert.deepEqual(cropBox(800, 600, NONE, 1200), { sx: 0, sy: 0, sw: 800, sh: 600, dw: 800, dh: 600 });
assert.deepEqual(cropBox(4000, 3000, { ...NONE, aspect: 1 }, 640), { sx: 500, sy: 0, sw: 3000, sh: 3000, dw: 640, dh: 640 });
assert.equal(cropBox(4000, 3000, { ...NONE, aspect: 1, x: 0 }, 640).sx, 0);
assert.equal(cropBox(4000, 3000, { ...NONE, aspect: 1, x: 1 }, 640).sx, 1000);
assert.equal(cropBox(3000, 4000, { ...NONE, aspect: 1, y: 1 }, 640).sy, 1000);
assert.deepEqual(cropBox(4000, 2000, { ...NONE, zoom: 2, x: 1, y: 0 }, 5000), { sx: 2000, sy: 0, sw: 2000, sh: 1000, dw: 2000, dh: 1000 });
for (const [w, h] of [[4000, 3000], [3000, 4000], [2000, 2000], [1, 5000]]) {
  for (const { value: aspect } of ASPECTS) {
    for (const zoom of [1, 2.5, 4]) {
      for (const p of [0, 0.3, 1, -5, 99, NaN]) {
        const b = cropBox(w, h, { aspect, zoom, x: p, y: p }, 640);
        assert.ok(b.sx >= 0 && b.sy >= 0 && b.sx + b.sw <= w + 1 && b.sy + b.sh <= h + 1, `crop left the photo: ${w}x${h} ${aspect} ${zoom} ${p}`);
        assert.ok(b.dw >= 1 && b.dh >= 1 && Math.max(b.dw, b.dh) <= 640, 'canvas size out of range');
      }
    }
  }
}
for (const [w, h] of [[0, 100], [100, 0], [NaN, 10]]) assert.throws(() => cropBox(w, h, NONE, 640), /bad image size/);

// Zooming out: the frame outgrows the photo, which stays inside it and can still be moved.
assert.deepEqual(cropBox(4000, 3000, { ...NONE, aspect: 1, zoom: 0.5 }, 640), { sx: -1000, sy: -1500, sw: 6000, sh: 6000, dw: 640, dh: 640 });
assert.ok(cropBox(1000, 1000, { ...NONE, zoom: 0.5, x: 0 }, 640).sx === 0);
assert.equal(cropBox(1000, 1000, { ...NONE, zoom: 0.5, x: 1 }, 640).sx, -1000);
assert.equal(clampZoom(0.01), ZOOM_MIN);
assert.equal(clampZoom(99), ZOOM_MAX);
assert.equal(clampZoom(NaN), 1);

// Dragging: the photo follows the finger, zoomed in or out, and stops at the edge.
assert.equal(dragged(0.5, 0.25, 500, 1000), 0.25); // frame half the photo: right moves the crop left
assert.equal(dragged(0.5, 0.25, 2000, 1000), 1); // frame twice the photo: right moves the photo right
assert.equal(dragged(0.5, 5, 500, 1000), 0);
assert.equal(dragged(0.5, 0.25, 1000, 1000), 0.5); // nowhere to go

// Top menu: chosen categories in category order, then the fixed links, which nothing can remove.
const cat = (id, heading) => ({ type: 'services', config: { id, catalog: true, heading } });
const about = { type: 'about', config: { id: 'about' } };
const secs = [cat('a', 'Aa'), cat('b', 'Bb'), cat('c', 'Cc'), about];
const fixed = [{ label: 'About', href: '#about' }, { label: 'Address', href: '#contact' }];
const hrefs = (nav) => nav.map((n) => n.href);
const withC = setInMenu(fixed, secs, secs[2], true);
assert.deepEqual(hrefs(withC), ['#c', '#about', '#contact']);
assert.equal(withC[0].label, 'Cc');
const withAC = setInMenu(withC, secs, secs[0], true);
assert.deepEqual(hrefs(withAC), ['#a', '#c', '#about', '#contact'], 'follows the category order, not the order ticked');
assert.deepEqual(hrefs(orderMenu(withAC, [secs[2], secs[1], secs[0], about])), ['#c', '#a', '#about', '#contact'], 'moving a category moves its link');
assert.deepEqual(hrefs(setInMenu(withAC, secs, secs[0], false)), ['#c', '#about', '#contact']);
assert.equal(setInMenu(withAC, secs, secs[2], true).filter((n) => n.href === '#c').length, 1, 'ticking twice adds one link');
assert.deepEqual(hrefs(orderMenu([{ href: '#about' }, { href: '#a' }], secs)), ['#a', '#about'], 'fixed links stay last');
assert.ok(isFixedLink(fixed[0], secs));
assert.ok(!isFixedLink({ href: '#a' }, secs));
const named = { nav: [{ label: 'A', href: '#a' }, { label: ' ', href: '#b' }, { label: 'About', href: '#about' }], sections: [{ enabled: false, config: { id: 'a' } }, about] };
assert.deepEqual(hrefs(visibleNav(named)), ['#about'], 'no links to hidden sections, and no empty names');
assert.deepEqual(visibleNav({}), []);

// Search and sharing: one address per site, and an image whenever the site has one.
assert.equal(canonicalOrigin({ hostnames: ['www.a.com', 'a.com', 'a.vercel.app'] }, 'a.vercel.app'), 'https://www.a.com');
assert.equal(canonicalOrigin({}, 'a.com'), 'https://a.com');
assert.match(robotsTxt('https://a.com'), /Disallow: \/api\/\n/);
assert.match(robotsTxt('https://a.com'), /Sitemap: https:\/\/a\.com\/sitemap\.xml/);
assert.doesNotMatch(robotsTxt('https://a.com'), /admin/, 'a crawler must be able to read the admin noindex tag');
assert.match(sitemapXml('https://a.com'), /<loc>https:\/\/a\.com\/<\/loc>/);
const hero = { type: 'hero', config: { image: 'hero.webp' } };
assert.equal(shareImage({ seo: { image: 'share.jpg' }, sections: [hero], brand: { logo: 'logo.webp' } }), 'share.jpg');
assert.equal(shareImage({ sections: [hero], brand: { logo: 'logo.webp' } }), 'hero.webp');
assert.equal(shareImage({ sections: [{ ...hero, enabled: false }], brand: { logo: 'logo.webp' } }), 'logo.webp');
assert.equal(shareImage({}), undefined);
assert.equal(toVars({ a: 'red;}</style><script>' }), '--a:red/style>script>;', 'a theme value cannot end the style element');

// Uploads: keys are built by the server and tied to the site.
const key = keyFor('site-a', 'image/webp');
assert.ok(ownsKey('site-a', key));
assert.ok(ownsKey('site-a', keyFor('site-a', 'image/jpeg')));
for (const bad of [
  key.replace('site-a', 'site-b'), 'site-a/../site-b/x.webp', `site-a/x/${key}`, 'site-a/x.webp',
  key.replace('.webp', '.html'), `${key}/`, null, 5, ['site-a/x'],
]) {
  assert.equal(ownsKey('site-a', bad), false, `ownsKey let through ${bad}`);
}
assert.equal(ownsKey('site-a-b', key), false, 'a site whose slug starts the same is a different site');
assert.equal(allowedType('image/webp') && allowedType('image/jpeg'), true);
for (const bad of ['image/svg+xml', 'text/html', 'image/png', 'constructor', null]) assert.equal(allowedType(bad), false, `allowedType let through ${bad}`);
const WEBP = new Uint8Array([...Buffer.from('RIFF'), 1, 2, 3, 4, ...Buffer.from('WEBP')]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const HTML = new Uint8Array(Buffer.from('<html><body>'));
assert.ok(bytesMatchKey(WEBP, 'a/b.webp') && bytesMatchKey(JPEG, 'a/b.jpg'));
for (const [bytes, name] of [[JPEG, 'a/b.webp'], [WEBP, 'a/b.jpg'], [HTML, 'a/b.webp'], [HTML, 'a/b.jpg'], [new Uint8Array(0), 'a/b.webp']]) {
  assert.equal(bytesMatchKey(bytes, name), false, `bytesMatchKey accepted ${name}`);
}

// Users and roles.
assert.equal(cleanUsername(' Ravi.K '), 'ravi.k');
for (const bad of ['a', 'has space', 'x'.repeat(51), 'రవి', null, 5]) assert.equal(cleanUsername(bad), null, `cleanUsername let through ${bad}`);
assert.ok(validPassword('x'.repeat(10)));
for (const bad of ['short', 'x'.repeat(201), null, 1234567890]) assert.equal(validPassword(bad), false);
assert.ok(validCaps(['content.edit', 'users.manage']) && validCaps([]));
for (const bad of [['content.edti'], ['events.edit'], 'content.edit', null]) assert.equal(validCaps(bad), false);
assert.ok(validRoleIds(['1', '22']) && validRoleIds([]));
for (const bad of [[1], ['1; drop table x'], '1', null]) assert.equal(validRoleIds(bad), false);
assert.equal(validUserId('00000000-0000-0000-0000-000000000000'), true);
assert.equal(validUserId("x' or 1=1"), false);

// The Roles screen offers exactly what the API accepts.
assert.deepEqual([...read('admin/people.tsx').matchAll(/^\s+'([a-z]+\.[a-z]+)': '/gm)].map((m) => m[1]), ASSIGNABLE_CAPS);

// Orders: the server prices every line from saved content, never from the browser.
const shop = {
  features: { orders: true },
  orders: { enabled: true },
  sections: [
    { type: 'services', config: { id: 'millets', catalog: true, items: [
      { title: 'కొర్రలు', title_2: 'Foxtail Millet', packs: [
        { label: '500 g', price: '90' }, { label: '1 kg', price: 170, offer: '150' }, { label: '2 kg', price: 300, offer: 300 }, { label: '', price: 5 }] },
      { title: 'NoPrice', packs: [] },
      { title: 'Hidden', enabled: false, packs: [{ label: '1 kg', price: 10 }] },
    ] } },
    { type: 'services', enabled: false, config: { id: 'off', catalog: true, items: [{ title: 'X', packs: [{ label: '1', price: 1 }] }] } },
  ],
};
assert.equal(ordersOn(shop), true);
assert.equal(ordersOn({ ...shop, features: {} }), false, 'platform flag needed');
assert.equal(ordersOn({ ...shop, orders: { enabled: false } }), false, 'owner switch needed');
assert.equal(ordersOn({}), false);
assert.deepEqual(packsOf(shop.sections[0].config.items[0]), [
  { label: '500 g', price: 90 }, { label: '1 kg', price: 170, offer: 150 }, { label: '2 kg', price: 300 }]);
assert.deepEqual(packsOf({}), []);
for (const ok of ['+91 95816 17244', '095816 17244', '9581617244', '91-9581617244']) assert.equal(cleanPhone(ok), '9581617244', ok);
for (const bad of ['12345', '5581617244', '95816172440', '', null, 9581617244]) assert.equal(cleanPhone(bad), null, `cleanPhone let through ${bad}`);

const line = (title, pack, qty = 1, cat = 'millets') => ({ cat, title, pack, qty });
const good = { name: ' Ravi ', phone: '+91 95816 17244', address: 'Street 1, Kollapur', items: [line('కొర్రలు', '500 g', 2), { ...line('కొర్రలు', '1 kg'), price: 1 }] };
const placed = prepareOrder(shop, good);
assert.equal(placed.total, 330);
assert.equal(placed.name, 'Ravi');
assert.equal(placed.phone, '9581617244');
assert.deepEqual(placed.items[0], { title: 'కొర్రలు', title_2: 'Foxtail Millet', pack: '500 g', price: 90, qty: 2 });
assert.deepEqual(placed.items[1], { title: 'కొర్రలు', title_2: 'Foxtail Millet', pack: '1 kg', price: 150, mrp: 170, qty: 1 }, 'offer applies, browser price ignored');
assert.equal(prepareOrder(shop, { ...good, items: [line('కొర్రలు', '500 g'), line('కొర్రలు', '500 g', 2)] }).items[0].qty, 3, 'same line merged');
for (const items of [[line('కొర్రలు', '500 g', 1, 'nope')], [line('Nope', '500 g')], [line('కొర్రలు', '5 kg')], [line('NoPrice', '1 kg')], [line('Hidden', '1 kg')], [line('X', '1', 1, 'off')]]) {
  assert.throws(() => prepareOrder(shop, { ...good, items }), /Some items changed/, JSON.stringify(items));
}
for (const bad of [
  null, 'x', { ...good, items: [] }, { ...good, items: 'x' }, { ...good, items: Array.from({ length: 31 }, (_, i) => line(`t${i}`, 'p')) },
  { ...good, items: [line('కొర్రలు', '500 g', 0)] }, { ...good, items: [line('కొర్రలు', '500 g', 51)] }, { ...good, items: [line('కొర్రలు', '500 g', 1.5)] },
  { ...good, name: ' ' }, { ...good, name: 'x'.repeat(81) }, { ...good, address: 'abc' }, { ...good, address: 'x'.repeat(301) },
  { ...good, phone: '123' }, { ...good, website: 'spam' },
]) {
  assert.throws(() => prepareOrder(shop, bad), OrderError, JSON.stringify(bad)?.slice(0, 80));
}
assert.throws(() => prepareOrder({ ...shop, orders: { enabled: false } }, good), OrderError, 'orders off');
const msg = orderMessage(placed, 1042);
for (const part of ['#1042', 'కొర్రలు (Foxtail Millet)', '500 g × 2 = ₹180', '1 kg × 1 = ₹150 (offer, was ₹170)', 'Total: ₹330', '9581617244', 'Street 1, Kollapur']) {
  assert.ok(msg.includes(part), `message is missing ${part}`);
}
assert.equal(decodeURIComponent(encodeURIComponent(msg)), msg);
assert.equal(prepareContent({ features: { orders: true } }, { features: { orders: false } }).features.orders, true, "owner can't change the platform flag");
assert.ok(!('features' in prepareContent({}, { features: { orders: true } })), "owner can't turn orders on for a site");

console.log('modules.check: ok');
