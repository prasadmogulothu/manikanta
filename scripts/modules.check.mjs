// The module contract: reusable outside Next.js, no site wording in src/, every
// declared class styled, and unsafe links dropped.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { asset, ctaHref, safeHref, safeMapUrl } from '../src/lib/links.ts';

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

console.log('modules.check: ok');
