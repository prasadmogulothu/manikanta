// Loads this folder's site into the database and its images into R2. Laptop only.
//   npm run seed            refuses if the site already exists, so it can't erase
//   npm run seed -- --force   the owner's edits. --force replaces the content.
import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Client } from '@neondatabase/serverless';
import { AwsClient } from 'aws4fetch';

const here = (f) => new URL(`../${f}`, import.meta.url);
const site = JSON.parse(await readFile(here('site.json'), 'utf8'));
const force = process.argv.includes('--force');

// ponytail: only this site's theme; the full catalogue is loaded in Phase 8.
const MARK = '/* ---- template css ---- */';
const css = await readFile(here('theme-a.css'), 'utf8');
const tokens = Object.fromEntries(
  [...css.match(/:root \{([^}]*)\}/)[1].matchAll(/--([\w-]+):([^;]+);/g)]
    .map(([, k, v]) => [k, v.trim().replace(/^'|'$/g, '')]),
);

const db = new Client(process.env.DATABASE_URL_OWNER);
await db.connect();
try {
  const existing = await db.query('select 1 from hh_sites where slug = $1', [site.slug]);
  if (existing.rows.length && !force) {
    throw new Error(`${site.slug} already exists. Use --force only if replacing its content is intended.`);
  }
  await db.query(
    `insert into hh_templates (key, name, category, tokens, css) values ($1, 'Polam Paper', 'retail', $2, $3)
     on conflict (key) do update set tokens = excluded.tokens, css = excluded.css, updated_at = now()`,
    [site.template_key, tokens, css.slice(css.indexOf(MARK) + MARK.length).trim()],
  );
  await db.query(
    `insert into hh_sites (slug, name, hostnames, template_key, config, published)
     values ($1, $2, $3, $4, $5, true)
     on conflict (slug) do update set name = excluded.name, hostnames = excluded.hostnames,
       template_key = excluded.template_key, config = excluded.config, updated_at = now()`,
    [site.slug, site.name, site.hostnames, site.template_key, site.config],
  );
} finally {
  await db.end();
}
console.log(`Database: ${site.slug} saved`);

const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const files = (await readdir(here('assets/img'))).filter((f) => TYPES[extname(f)]);
for (const file of files) {
  const res = await r2.fetch(
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${site.slug}/${file}`,
    {
      method: 'PUT',
      body: await readFile(here(`assets/img/${file}`)),
      headers: { 'Content-Type': TYPES[extname(file)], 'Cache-Control': 'public, max-age=31536000' },
    },
  );
  if (!res.ok) throw new Error(`${file}: ${res.status} ${await res.text()}`);
}
console.log(`R2: ${files.length} images uploaded`);
