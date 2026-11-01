// Proves dynamic-admin-page.md §6 over real HTTP, against a Neon dev branch. It creates
// test sites, so it refuses to run on anything that looks like production.
//   npm run check:api
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import http from 'node:http';
import { Client } from '@neondatabase/serverless';
import { migrate } from './migrate.mjs';
import { hashPassword } from '../src/lib/password.ts';

const ownerUrl = process.env.DATABASE_URL_OWNER_DEV;
if (!ownerUrl) throw new Error('DATABASE_URL_OWNER_DEV is not set (owner role, direct connection, Neon dev branch)');
const prod = new URL(process.env.DATABASE_URL_OWNER).hostname.replace('-pooler', '');
const dev = new URL(ownerUrl);
if (dev.hostname.replace('-pooler', '') === prod) throw new Error('This points at production. Use the dev branch.');

// Branches keep their roles and passwords, so hh_app's password is the production one.
const appUrl = new URL(process.env.DATABASE_URL);
appUrl.hostname = dev.hostname.replace(/^([^.]+?)(-pooler)?\./, '$1-pooler.');

const PORT = 3456;
const HOST_A = 'test-a.check.invalid';
const HOST_B = 'test-b.check.invalid';
const PASS = 'test-password-a';

const db = new Client(ownerUrl);
await db.connect();
await migrate(db);
await db.query(`delete from hh_sites where slug in ('check-a', 'check-b')`);
await db.query(`insert into hh_templates (key, name) values ('check', 'Check') on conflict do nothing`);
const addSite = async (slug, host, marker) =>
  (await db.query(
    `insert into hh_sites (slug, name, hostnames, template_key, published, config)
     values ($1, $1, $2, 'check', true, $3) returning id`,
    [slug, [host], { theme: { accent: slug }, tracking: { enabled: false }, footer: { powered_by: 'HH' },
      sections: [{ type: 'hero', config: { heading: marker } }] }],
  )).rows[0].id;
const siteA = await addSite('check-a', HOST_A, 'HEADING-A');
const siteB = await addSite('check-b', HOST_B, 'HEADING-B');
const hash = await hashPassword(PASS);
const addUser = async (site, username, isOwner) =>
  (await db.query(
    'insert into hh_users (site_id, username, password_hash, is_owner) values ($1, $2, $3, $4) returning id',
    [site, username, hash, isOwner],
  )).rows[0].id;
await addUser(siteA, 'owner', true);
await addUser(siteB, 'owner', true);
await addUser(siteA, 'nocaps', false);
const editor = await addUser(siteA, 'editor', false);
const role = (await db.query(
  `insert into hh_roles (site_id, key, name, caps) values ($1, 'ed', 'Editor', '{content.edit}') returning id`,
  [siteA],
)).rows[0].id;
await db.query('insert into hh_user_roles (site_id, user_id, role_id) values ($1, $2, $3)', [siteA, editor, role]);

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
  env: { ...process.env, DATABASE_URL: appUrl.href, SITE_HOST_OVERRIDE: '' },
  stdio: 'ignore',
});

function call(method, path, { host = HOST_A, cookie, bearer, body, origin = `http://${host}`, ip } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const headers = { host };
    if (payload) headers['content-type'] = 'application/json';
    if (payload) headers['content-length'] = Buffer.byteLength(payload);
    if (cookie) headers.cookie = cookie;
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (origin) headers.origin = origin;
    if (ip) headers['x-real-ip'] = ip;
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, data, text, setCookie: res.headers['set-cookie']?.[0] });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function login(username, host = HOST_A, password = PASS, ip = '10.0.0.1') {
  const res = await call('POST', '/api/v1/auth/login', { host, body: { username, password }, ip });
  assert.equal(res.status, 200, `${username} should sign in on ${host}: ${res.text}`);
  return { cookie: res.setCookie.split(';')[0], token: res.data.token, setCookie: res.setCookie };
}

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
};

try {
  for (let i = 0; ; i++) {
    try { await call('GET', '/'); break; } catch (err) {
      if (i > 60) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const a = await login('owner');
  const b = await login('owner', HOST_B);
  const ROUTES = [
    ['GET', '/api/v1/auth/me', 'auth/me/route.ts'],
    ['POST', '/api/v1/auth/logout', 'auth/logout/route.ts'],
    ['POST', '/api/v1/auth/password', 'auth/password/route.ts', { current: PASS, next: 'not-going-to-happen' }],
    ['GET', '/api/v1/content', 'content/route.ts'],
    ['PUT', '/api/v1/content', 'content/route.ts', { version: 0, config: {} }],
    ['GET', '/api/v1/versions', 'versions/route.ts'],
    ['POST', '/api/v1/versions/1/restore', 'versions/[id]/restore/route.ts', { version: 0 }],
  ];

  await test('every admin route is covered by this table', () => {
    const files = readdirSync(new URL('../src/app/api/v1/', import.meta.url), { recursive: true })
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => f.endsWith('route.ts') && f !== 'auth/login/route.ts');
    for (const f of files) assert.ok(ROUTES.some((r) => r[2] === f), `${f} is missing from ROUTES`);
  });

  await test('no session is refused on every route', async () => {
    for (const [m, p, , body] of ROUTES) assert.equal((await call(m, p, { body })).status, 401, `${m} ${p}`);
  });

  await test('an expired session is refused', async () => {
    const s = await login('owner');
    await db.query(`update hh_sessions set expires_at = now() - interval '1 minute' where user_id = (select id from hh_users where site_id = $1 and username = 'owner') and expires_at = (select max(expires_at) from hh_sessions)`, [siteA]);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: s.cookie })).status, 401);
  });

  await test("another site's owner is refused on every route", async () => {
    for (const [m, p, , body] of ROUTES) {
      assert.equal((await call(m, p, { cookie: b.cookie, body })).status, 403, `${m} ${p}`);
    }
  });

  await test("a Bearer token only ever reaches its own site", async () => {
    const res = await call('GET', '/api/v1/content', { bearer: b.token });
    assert.equal(res.status, 200);
    assert.equal(res.data.config.sections[0].config.heading, 'HEADING-B');
  });

  const staff = await login('nocaps');
  await test('staff without content.edit are refused', async () => {
    assert.equal((await call('GET', '/api/v1/content', { cookie: staff.cookie })).status, 403);
    assert.equal((await call('PUT', '/api/v1/content', { cookie: staff.cookie, body: { version: 0, config: {} } })).status, 403);
    assert.equal((await call('GET', '/api/v1/versions', { cookie: staff.cookie })).status, 403);
  });

  const ed = await login('editor');
  await test('staff with content.edit can read', async () => {
    assert.equal((await call('GET', '/api/v1/content', { cookie: ed.cookie })).status, 200);
  });

  await test('a write from another origin, or none, is refused', async () => {
    const body = { version: 0, config: {} };
    assert.equal((await call('PUT', '/api/v1/content', { cookie: a.cookie, body, origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('PUT', '/api/v1/content', { cookie: a.cookie, body, origin: null })).status, 403);
  });

  const get = async () => (await call('GET', '/api/v1/content', { cookie: a.cookie })).data;
  const put = (config, version, extra = {}) =>
    call('PUT', '/api/v1/content', { cookie: a.cookie, body: { config, version, ...extra } });

  await test('oversized or non-object content is refused', async () => {
    const { version } = await get();
    for (const config of [[], 'x', 5, null, { big: 'x'.repeat(1_000_001) }]) {
      assert.equal((await put(config, version)).status, 400);
    }
  });

  await test('more than one popup flyer is refused', async () => {
    const { version } = await get();
    const sections = [{ type: 'gallery', config: { images: [{ popup: true }, { popup: true }] } }];
    assert.equal((await put({ sections }, version)).status, 400);
  });

  await test('a save refreshes the public page straight away', async () => {
    const { config, version } = await get();
    const before = await call('GET', '/');
    assert.ok(before.text.includes('HEADING-A'));
    assert.equal((await call('GET', '/')).status, 200);
    const next = { ...config, sections: [{ type: 'hero', config: { heading: 'HEADING-A2' } }] };
    assert.equal((await put(next, version)).status, 200);
    const after = await call('GET', '/');
    assert.ok(after.text.includes('HEADING-A2'), 'the new heading should show after saving');
  });

  await test('platform fields stay, and a named site_id is ignored', async () => {
    const { config, version } = await get();
    const res = await put(
      { ...config, theme: { accent: 'evil' }, tracking: { enabled: true }, footer: { powered_by: 'Evil', note: 'n' } },
      version,
      { site_id: siteB },
    );
    assert.equal(res.status, 200);
    const after = await get();
    assert.equal(after.config.theme.accent, 'check-a');
    assert.equal(after.config.tracking.enabled, false);
    assert.equal(after.config.footer.powered_by, 'HH');
    assert.equal(after.config.footer.note, 'n');
    const other = await call('GET', '/api/v1/content', { host: HOST_B, cookie: b.cookie });
    assert.equal(other.data.config.sections[0].config.heading, 'HEADING-B');
    assert.equal(other.data.version, 0);
  });

  await test('a save from an out-of-date copy is refused and overwrites nothing', async () => {
    const { config, version } = await get();
    assert.equal((await put({ ...config, stale: true }, version - 1)).status, 409);
    assert.ok(!('stale' in (await get()).config));
    assert.equal((await get()).version, version);
  });

  await test('each save keeps a version, and Restore brings it back', async () => {
    const list = async () => (await call('GET', '/api/v1/versions', { cookie: a.cookie })).data.versions;
    const { config, version } = await get();
    const count = (await list()).length;
    await put({ ...config, marker: 'keep-me' }, version);
    const saved = (await list())[0];
    assert.equal((await list()).length, count + 1);
    assert.equal(saved.saved_by, 'owner');
    const now = await get();
    await put({ ...now.config, marker: 'mistake' }, now.version);
    const latest = await get();
    const restored = await call('POST', `/api/v1/versions/${saved.id}/restore`, { cookie: a.cookie, body: { version: latest.version } });
    assert.equal(restored.status, 200);
    assert.equal((await get()).config.marker, 'keep-me');
    assert.ok((await call('GET', '/')).status === 200);
  });

  await test("another site's version can't be restored", async () => {
    const bNow = await call('GET', '/api/v1/content', { host: HOST_B, cookie: b.cookie });
    await call('PUT', '/api/v1/content', { host: HOST_B, cookie: b.cookie, body: { config: bNow.data.config, version: bNow.data.version } });
    const id = (await call('GET', '/api/v1/versions', { host: HOST_B, cookie: b.cookie })).data.versions[0].id;
    const { version } = await get();
    const res = await call('POST', `/api/v1/versions/${id}/restore`, { cookie: a.cookie, body: { version } });
    assert.equal(res.status, 404);
  });

  await test('only the last 30 versions are kept', async () => {
    const seed = (await get());
    await db.query(
      `insert into hh_site_versions (site_id, config, saved_by) select $1, '{}', 'seed' from generate_series(1, 40)`,
      [siteA],
    );
    await put(seed.config, seed.version);
    const { rows } = await db.query('select count(*)::int as n from hh_site_versions where site_id = $1', [siteA]);
    assert.equal(rows[0].n, 30);
  });

  await test('six wrong passwords lock the login, even with the right one', async () => {
    const tryLogin = (password, ip = '10.9.9.9') => call('POST', '/api/v1/auth/login', { body: { username: 'owner', password }, ip });
    for (let i = 0; i < 5; i++) assert.equal((await tryLogin('nope')).status, 401);
    assert.equal((await tryLogin('nope')).status, 429);
    assert.equal((await tryLogin(PASS)).status, 429);
    assert.equal((await tryLogin(PASS, '10.9.9.10')).status, 200, 'another address is not locked');
  });

  await test('an unknown username looks the same as a wrong password', async () => {
    const res = await call('POST', '/api/v1/auth/login', { body: { username: 'nobody', password: 'x' }, ip: '10.8.8.8' });
    const wrong = await call('POST', '/api/v1/auth/login', { body: { username: 'owner', password: 'x' }, ip: '10.8.8.8' });
    assert.equal(res.status, 401);
    assert.equal(res.text, wrong.text);
  });

  await test('the session cookie is HttpOnly, Secure and SameSite=Lax', () => {
    assert.match(a.setCookie, /HttpOnly/);
    assert.match(a.setCookie, /Secure/);
    assert.match(a.setCookie, /SameSite=Lax/);
  });

  await test('only a hash of the session token is stored', async () => {
    const { rows } = await db.query('select count(*)::int as n from hh_sessions where token_hash = $1', [a.token]);
    assert.equal(rows[0].n, 0);
  });

  await test('changing a password ends the old sessions and keeps this device signed in', async () => {
    const other = await login('editor');
    const mine = await login('editor');
    const short = await call('POST', '/api/v1/auth/password', { cookie: mine.cookie, body: { current: PASS, next: 'short' } });
    assert.equal(short.status, 400);
    const wrong = await call('POST', '/api/v1/auth/password', { cookie: mine.cookie, body: { current: 'bad', next: 'a-new-password' } });
    assert.equal(wrong.status, 403);
    const res = await call('POST', '/api/v1/auth/password', { cookie: mine.cookie, body: { current: PASS, next: 'a-new-password' } });
    assert.equal(res.status, 200);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: other.cookie })).status, 401);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: mine.cookie })).status, 401);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: res.setCookie.split(';')[0] })).status, 200);
    await login('editor', HOST_A, 'a-new-password');
  });

  await test('logging out ends the session', async () => {
    const s = await login('nocaps');
    assert.equal((await call('POST', '/api/v1/auth/logout', { cookie: s.cookie })).status, 200);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: s.cookie })).status, 401);
  });

  await test('a javascript: link and a foreign map are dropped from the page', async () => {
    const { config, version } = await get();
    const sections = [
      { type: 'hero', config: { heading: 'H', ctas: [{ label: 'Bad', href: 'javascript:alert(1)' }] } },
      { type: 'contact', config: { show_map: true } },
    ];
    await put({ ...config, sections, contact: { phone: '+911', map_embed: 'https://evil.example/maps' } }, version);
    const page = (await call('GET', '/')).text;
    assert.ok(!page.includes('javascript:alert'));
    assert.ok(!page.includes('evil.example'));
  });

  await test('the app role still has no schema rights', async () => {
    const app = new Client(appUrl.href);
    await app.connect();
    await assert.rejects(app.query('create table api_check_evil (id int)'));
    await assert.rejects(app.query('update hh_sites set published = false'));
    await app.end();
  });

  console.log(`api.check: ok (${passed} tests)`);
} finally {
  server.kill();
  await db.query(`delete from hh_sites where slug in ('check-a', 'check-b')`).catch(() => {});
  await db.end();
}
process.exit(0);
