// The module contract: reusable outside Next.js, no site wording in src/, every
// declared class styled, and unsafe links dropped.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ContentError, MAX_CONTENT_BYTES, prepareContent } from '../src/lib/content.ts';
import { asset, ctaHref, safeHref, safeMapUrl } from '../src/lib/links.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../src/lib/password.ts';

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

console.log('modules.check: ok');
