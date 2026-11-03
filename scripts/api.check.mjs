// Proves dynamic-admin-page.md §6 over real HTTP, against a Neon dev branch. It creates
// test sites, so it refuses to run on anything that looks like production.
//   npm run check:api
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { Client } from '@neondatabase/serverless';
import { migrate } from './migrate.mjs';
import { hashPassword } from '../src/lib/password.ts';
import { deleteUpload } from '../src/lib/uploads.ts';

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
const NO_USER = '00000000-0000-0000-0000-000000000000';

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

// Each run makes new test sites; a page cached by the last run would show its old content.
rmSync(new URL('../.next/cache/fetch-cache', import.meta.url), { recursive: true, force: true });
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
        resolve({ status: res.statusCode, data, text, headers: res.headers, setCookie: res.headers['set-cookie']?.[0] });
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
    ['POST', '/api/v1/uploads', 'uploads/route.ts', { type: 'image/webp', size: 100 }],
    ['POST', '/api/v1/uploads/confirm', 'uploads/confirm/route.ts', { key: 'check-a/x.webp' }],
    ['GET', '/api/v1/users', 'users/route.ts'],
    ['POST', '/api/v1/users', 'users/route.ts', { username: 'nope', password: PASS }],
    ['PATCH', `/api/v1/users/${NO_USER}`, 'users/[id]/route.ts', { roleIds: [] }],
    ['DELETE', `/api/v1/users/${NO_USER}`, 'users/[id]/route.ts'],
    ['GET', '/api/v1/roles', 'roles/route.ts'],
    ['POST', '/api/v1/roles', 'roles/route.ts', { name: 'Nope', caps: [] }],
    ['PATCH', '/api/v1/roles/1', 'roles/[id]/route.ts', { name: 'Nope', caps: [] }],
    ['DELETE', '/api/v1/roles/1', 'roles/[id]/route.ts'],
    ['GET', '/api/v1/orders', 'orders/route.ts'],
    ['PATCH', '/api/v1/orders/1', 'orders/[id]/route.ts', { status: 'delivered' }],
  ];

  await test('every admin route is covered by this table', () => {
    const files = readdirSync(new URL('../src/app/api/v1/', import.meta.url), { recursive: true })
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => f.endsWith('route.ts') && !['auth/login/route.ts', 'orders/place/route.ts'].includes(f));
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

  // Uploads go to the real bucket, under this test site's own prefix, and are removed.
  const webpBytes = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(88)]);
  const htmlBytes = Buffer.from('<html>'.padEnd(100, ' '));
  const sign = (session, body, host = HOST_A) => call('POST', '/api/v1/uploads', { host, cookie: session.cookie, body });
  const confirm = (key, session = a) => call('POST', '/api/v1/uploads/confirm', { cookie: session.cookie, body: { key } });
  const send = (s, bytes) => fetch(s.url, { method: 'PUT', body: bytes, headers: s.headers });
  const stored = [];
  const signed = async (type = 'image/webp', size = 100) => {
    const res = await sign(a, { type, size });
    assert.equal(res.status, 200, res.text);
    stored.push(res.data.key);
    return res.data;
  };

  await test('an upload stays in the session site, whatever the request names', async () => {
    const s = await signed();
    assert.match(s.key, /^check-a\/[0-9a-f-]{36}\.webp$/);
    const named = await sign(a, { type: 'image/webp', size: 100, site_id: siteB, slug: 'check-b', key: 'check-b/x.webp' });
    assert.match(named.data.key, /^check-a\//);
    stored.push(named.data.key);
  });

  await test('an upload of the wrong type or size is refused before signing', async () => {
    for (const type of ['image/svg+xml', 'text/html', 'image/png', undefined]) {
      assert.equal((await sign(a, { type, size: 100 })).status, 400, type);
    }
    for (const size of [0, -1, 1.5, '100', undefined]) {
      assert.equal((await sign(a, { type: 'image/webp', size })).status, 400, String(size));
    }
    assert.equal((await sign(a, { type: 'image/webp', size: 2_000_001 })).status, 413);
  });

  await test('R2 refuses anything other than the signed type and length', async () => {
    const s = await signed();
    const html = await fetch(s.url, { method: 'PUT', body: webpBytes, headers: { ...s.headers, 'Content-Type': 'text/html' } });
    assert.equal(html.status, 403);
    assert.equal((await send(s, Buffer.concat([webpBytes, webpBytes]))).status, 403);
  });

  await test('a real photo uploads, confirms and displays with a long cache', async () => {
    const s = await signed();
    assert.equal((await send(s, webpBytes)).status, 200);
    const res = await confirm(s.key);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.data.key, s.key);
    const shown = await fetch(`${process.env.NEXT_PUBLIC_IMAGE_BASE}/${s.key}`);
    assert.equal(shown.status, 200);
    assert.equal(shown.headers.get('content-type'), 'image/webp');
    assert.match(shown.headers.get('cache-control'), /max-age=31536000/);
    await shown.arrayBuffer();
  });

  await test('a file that is not what it claims is deleted at confirm', async () => {
    for (const [type, bytes] of [['image/webp', htmlBytes], ['image/jpeg', webpBytes]]) {
      const s = await signed(type);
      assert.equal((await send(s, bytes)).status, 200);
      assert.equal((await confirm(s.key)).status, 400);
      assert.equal((await confirm(s.key)).status, 404, 'the file should be gone');
    }
  });

  await test("confirm refuses another site's file, and a file never sent", async () => {
    const other = await sign(b, { type: 'image/webp', size: 100 }, HOST_B);
    assert.equal((await send(other.data, webpBytes)).status, 200);
    stored.push(other.data.key);
    assert.equal((await confirm(other.data.key)).status, 403);
    assert.equal((await confirm('check-a/../check-b/x.webp')).status, 403);
    const never = await signed();
    assert.equal((await confirm(never.key)).status, 404);
  });

  await test('staff without content.edit cannot upload', async () => {
    assert.equal((await sign(staff, { type: 'image/webp', size: 100 })).status, 403);
    assert.equal((await confirm('check-a/x.webp', staff)).status, 403);
  });

  for (const key of stored) await deleteUpload(key);

  // Users and roles.
  const as = (session) => ({
    get: (p) => call('GET', `/api/v1${p}`, { cookie: session.cookie }),
    post: (p, body) => call('POST', `/api/v1${p}`, { cookie: session.cookie, body }),
    patch: (p, body) => call('PATCH', `/api/v1${p}`, { cookie: session.cookie, body }),
    del: (p) => call('DELETE', `/api/v1${p}`, { cookie: session.cookie }),
  });
  const owner = as(a);
  const idOf = async (username) => (await owner.get('/users')).data.users.find((u) => u.username === username)?.id;
  const addRole = async (name, caps) => {
    const res = await owner.post('/roles', { name, caps });
    assert.equal(res.status, 201, res.text);
    return res.data.id;
  };
  const addStaff = async (username, roleIds) => {
    const res = await owner.post('/users', { username, password: PASS, roleIds });
    assert.equal(res.status, 201, res.text);
    return res.data.id;
  };

  const managerRole = await addRole('Manager', ['users.manage']);
  const contentRole = await addRole('Content', ['content.edit']);
  await addStaff('Mgr', [managerRole]);
  const mgrSession = await login('mgr');
  const mgr = as(mgrSession);

  await test('a role allows what it says and the API refuses the rest', async () => {
    assert.equal((await mgr.get('/users')).status, 200);
    assert.equal((await mgr.get('/roles')).status, 200);
    assert.equal((await mgr.get('/content')).status, 403);
    assert.equal((await sign(mgrSession, { type: 'image/webp', size: 100 })).status, 403);
    const editor2 = await addStaff('writer', [contentRole]);
    const writer = as(await login('writer'));
    assert.equal((await writer.get('/content')).status, 200);
    for (const res of [
      await writer.get('/users'),
      await writer.get('/roles'),
      await writer.post('/users', { username: 'sneaky', password: PASS }),
      await writer.post('/roles', { name: 'Sneaky', caps: ['users.manage'] }),
      await writer.patch(`/users/${editor2}`, { roleIds: [managerRole] }),
      await writer.patch(`/roles/${contentRole}`, { name: 'Content', caps: ['users.manage'] }),
      await writer.del(`/roles/${contentRole}`),
    ]) {
      assert.equal(res.status, 403);
    }
  });

  await test('a role change applies straight away, without signing in again', async () => {
    const id = await idOf('mgr');
    assert.equal((await owner.patch(`/users/${id}`, { roleIds: [contentRole] })).status, 200);
    assert.equal((await mgr.get('/users')).status, 403);
    assert.equal((await mgr.get('/content')).status, 200);
    assert.equal((await owner.patch(`/users/${id}`, { roleIds: [contentRole, managerRole] })).status, 200, 'keeps one, adds one');
    assert.equal((await mgr.get('/users')).status, 200);
    assert.equal((await owner.patch(`/users/${id}`, { roleIds: [managerRole] })).status, 200);
    assert.equal((await mgr.get('/content')).status, 403);
    assert.deepEqual((await owner.get('/users')).data.users.find((u) => u.id === id).role_ids, [managerRole]);
  });

  await test("nobody can change or remove the owner, or remove themselves", async () => {
    const ownerId = await idOf('owner');
    assert.equal((await mgr.patch(`/users/${ownerId}`, { password: 'taken-over-now' })).status, 403);
    assert.equal((await mgr.patch(`/users/${ownerId}`, { roleIds: [] })).status, 403);
    assert.equal((await mgr.del(`/users/${ownerId}`)).status, 403);
    assert.equal((await owner.del(`/users/${ownerId}`)).status, 400);
    const mgrId = await idOf('mgr');
    assert.equal((await mgr.del(`/users/${mgrId}`)).status, 400);
    assert.equal((await mgr.patch(`/users/${mgrId}`, { password: 'skips-the-current' })).status, 400);
    await login('owner');
  });

  await test("another site's users and roles can't be seen or touched, even with a Bearer token", async () => {
    const bearer = (m, p, body) => call(m, `/api/v1${p}`, { host: HOST_B, bearer: b.token, body });
    const writerId = await idOf('writer');
    const seen = (await bearer('GET', '/users')).data.users.map((u) => u.username);
    assert.deepEqual(seen, ['owner']);
    assert.deepEqual((await bearer('GET', '/roles')).data.roles, []);
    assert.equal((await bearer('PATCH', `/users/${writerId}`, { password: 'taken-over-now' })).status, 404);
    assert.equal((await bearer('DELETE', `/users/${writerId}`)).status, 404);
    assert.equal((await bearer('PATCH', `/roles/${contentRole}`, { name: 'X', caps: [] })).status, 404);
    assert.equal((await bearer('DELETE', `/roles/${contentRole}`)).status, 404);
    assert.equal((await bearer('POST', '/users', { username: 'stolen', password: PASS, roleIds: [contentRole] })).status, 400);
    const bOwner = (await bearer('GET', '/users')).data.users[0].id;
    assert.equal((await bearer('PATCH', `/users/${bOwner}`, { roleIds: [contentRole] })).status, 403);
    assert.ok(await idOf('writer'), 'the user is still there');
    assert.equal((await owner.get('/roles')).data.roles.find((r) => r.id === contentRole).name, 'Content');
  });

  await test('bad staff and role details are refused', async () => {
    for (const body of [
      { username: 'x', password: PASS },
      { username: 'has space', password: PASS },
      { username: 'okname', password: 'short' },
      { username: 'okname', password: PASS, roleIds: ['abc'] },
      { username: 'okname', password: PASS, roleIds: ['999999999'] },
      { username: 'okname', password: PASS, roleIds: 'x' },
    ]) {
      assert.equal((await owner.post('/users', body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await owner.post('/users', { username: 'WRITER', password: PASS })).status, 409);
    assert.equal((await owner.post('/roles', { name: '', caps: [] })).status, 400);
    assert.equal((await owner.post('/roles', { name: 'X', caps: ['content.edti'] })).status, 400);
    assert.equal((await owner.post('/roles', { name: 'X', caps: ['events.edit'] })).status, 400);
    assert.equal((await owner.post('/roles', { name: 'content', caps: [] })).status, 409);
    assert.equal((await owner.patch(`/roles/${contentRole}`, { name: 'manager', caps: [] })).status, 409);
    assert.equal((await owner.patch('/roles/abc', { name: 'X', caps: [] })).status, 404);
    assert.equal((await owner.patch('/users/abc', { roleIds: [] })).status, 404);
  });

  await test('resetting a password ends that user\'s sessions and the new one works', async () => {
    const id = await addStaff('resetme', []);
    const before = await login('resetme');
    assert.equal((await owner.patch(`/users/${id}`, { password: 'short' })).status, 400);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: before.cookie })).status, 200);
    assert.equal((await owner.patch(`/users/${id}`, { password: 'a-brand-new-pass' })).status, 200);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: before.cookie })).status, 401);
    await login('resetme', HOST_A, 'a-brand-new-pass');
  });

  await test('removing staff ends their access, and history keeps their name', async () => {
    const id = await addStaff('leaver', [contentRole]);
    const leaver = await login('leaver');
    const { config, version } = (await as(leaver).get('/content')).data;
    assert.equal((await call('PUT', '/api/v1/content', { cookie: leaver.cookie, body: { config, version } })).status, 200);
    assert.equal((await owner.del(`/users/${id}`)).status, 200);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: leaver.cookie })).status, 401);
    assert.equal((await call('POST', '/api/v1/auth/login', { body: { username: 'leaver', password: PASS }, ip: '10.7.7.7' })).status, 401);
    assert.equal((await owner.get('/versions')).data.versions[0].saved_by, 'leaver');
  });

  await test('deleting a role takes its capabilities away and keeps the user', async () => {
    const id = await addRole('Temp', ['content.edit']);
    const userId = await addStaff('tempstaff', [id]);
    const temp = as(await login('tempstaff'));
    assert.equal((await temp.get('/content')).status, 200);
    assert.equal((await owner.del(`/roles/${id}`)).status, 200);
    assert.equal((await temp.get('/content')).status, 403);
    assert.deepEqual((await owner.get('/users')).data.users.find((u) => u.id === userId).role_ids, []);
    assert.equal((await owner.del(`/roles/${id}`)).status, 404);
  });

  await test('one address cannot try a password on many accounts', async () => {
    const ip = '10.6.6.6';
    const attempt = (username) => call('POST', '/api/v1/auth/login', { body: { username, password: 'not-the-password' }, ip });
    for (let i = 0; i < 30; i++) assert.equal((await attempt(`spray${i}`)).status, 401, `attempt ${i}`);
    assert.equal((await attempt('spray-another')).status, 429);
    assert.equal((await call('POST', '/api/v1/auth/login', { body: { username: 'owner', password: PASS }, ip })).status, 429, 'even with the right password');
    assert.equal((await call('POST', '/api/v1/auth/login', { body: { username: 'owner', password: PASS }, ip: '10.6.6.7' })).status, 200, 'another address is fine');
  });

  await test('an oversized current password is refused before hashing', async () => {
    const owner = as(await login('owner'));
    assert.equal((await owner.post('/auth/password', { current: 'x'.repeat(201), next: 'long-enough-password' })).status, 403);
  });

  await test('every response refuses to be framed', async () => {
    for (const path of ['/admin', '/api/v1/auth/me', '/', '/robots.txt']) {
      const { headers } = await call('GET', path);
      assert.equal(headers['x-frame-options'], 'DENY', path);
      assert.equal(headers['content-security-policy'], "frame-ancestors 'none'", path);
      assert.equal(headers['x-content-type-options'], 'nosniff', path);
    }
  });

  await test('each site has its own robots, sitemap and share tags', async () => {
    const robots = await call('GET', '/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.headers['content-type'], /text\/plain/);
    assert.ok(robots.text.includes(`Sitemap: https://${HOST_A}/sitemap.xml`), robots.text);
    const map = await call('GET', '/sitemap.xml', { host: HOST_B });
    assert.equal(map.status, 200);
    assert.match(map.headers['content-type'], /application\/xml/);
    assert.ok(map.text.includes(`<loc>https://${HOST_B}/</loc>`), map.text);
    assert.equal((await call('GET', '/robots.txt', { host: 'nobody.check.invalid' })).status, 404);
    const home = (await call('GET', '/')).text;
    assert.ok(home.includes(`<link rel="canonical" href="https://${HOST_A}"`) || home.includes(`<link rel="canonical" href="https://${HOST_A}/"`), 'canonical tag');
    assert.match(home, /<meta property="og:title"/);
    assert.match(home, /<meta property="og:site_name"/);
    assert.match(home, /<meta name="twitter:card"/);
  });

  // Orders: site A takes them, site B may but its owner has them switched off.
  const SHOP = (enabled) => ({
    theme: {}, features: { orders: true }, orders: { enabled },
    sections: [{ type: 'services', config: { id: 'millets', catalog: true, items: [
      { title: 'Ragi', packs: [{ label: '1 kg', price: 100, offer: 90 }] }] } }],
  });
  await db.query('update hh_sites set config = $2 where id = $1', [siteA, SHOP(true)]);
  await db.query('update hh_sites set config = $2 where id = $1', [siteB, SHOP(false)]);
  const ORDER = { name: 'Ravi', phone: '9581617244', address: 'Street 1, Town', items: [{ cat: 'millets', title: 'Ragi', pack: '1 kg', qty: 2, price: 1 }] };
  const place = (opts = {}) => call('POST', '/api/v1/orders/place', { body: ORDER, ip: '10.9.0.1', ...opts });

  await test('an order is saved for the site at that address, priced by the server', async () => {
    const res = await place();
    assert.equal(res.status, 200, res.text);
    assert.equal(res.data.order.total, 180);
    const row = (await db.query('select site_id, total, status, items from hh_orders where id = $1', [res.data.id])).rows[0];
    assert.equal(row.site_id, siteA);
    assert.equal(row.total, 180);
    assert.equal(row.status, 'received');
    assert.equal(row.items[0].mrp, 100);
  });

  await test('an order from another page, or none, is refused', async () => {
    assert.equal((await place({ origin: 'https://evil.example' })).status, 403);
    assert.equal((await place({ origin: null })).status, 403);
  });

  await test('orders switched off are refused', async () => {
    const res = await place({ host: HOST_B });
    assert.equal(res.status, 403);
    assert.match(res.data.error, /Orders are closed/);
  });

  await test('a changed product is refused, not guessed', async () => {
    const res = await place({ body: { ...ORDER, items: [{ ...ORDER.items[0], pack: '5 kg' }] } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /Some items changed/);
  });

  await test('one connection can place 5 orders an hour', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await place({ ip: '10.9.0.2' })).status, 200);
    assert.equal((await place({ ip: '10.9.0.2' })).status, 429);
    assert.equal((await place({ ip: '10.9.0.3' })).status, 200, 'another connection still can');
  });

  await test('each site sees and updates only its own orders', async () => {
    const mine = (await call('GET', '/api/v1/orders', { cookie: a.cookie })).data.orders;
    assert.ok(mine.length >= 7, 'site A sees its orders');
    assert.ok(!('ip' in mine[0]), 'the ip stays on the server');
    assert.ok(mine[0].id > mine[1].id, 'newest first');
    assert.deepEqual((await call('GET', '/api/v1/orders', { host: HOST_B, cookie: b.cookie })).data.orders, []);
    const id = mine[0].id;
    const patch = (body, opts = {}) => call('PATCH', `/api/v1/orders/${id}`, { cookie: a.cookie, body, ...opts });
    assert.equal((await patch({ status: 'delivered' }, { host: HOST_B, cookie: b.cookie })).status, 404, "another site's order");
    assert.equal((await patch({ status: 'cancelled' })).status, 400, 'cancel needs a reason');
    assert.equal((await patch({ status: 'cancelled', reason: ' ' })).status, 400, 'cancel needs a reason');
    assert.equal((await patch({ status: 'shipped' })).status, 400);
    assert.equal((await call('PATCH', '/api/v1/orders/x', { cookie: a.cookie, body: { status: 'delivered' } })).status, 404);
    assert.equal((await patch({ status: 'cancelled', reason: 'Out of stock' })).status, 200);
    let row = (await db.query('select status, cancel_reason from hh_orders where id = $1', [id])).rows[0];
    assert.deepEqual(row, { status: 'cancelled', cancel_reason: 'Out of stock' });
    assert.equal((await patch({ status: 'delivered', reason: 'ignored' })).status, 200);
    row = (await db.query('select status, cancel_reason from hh_orders where id = $1', [id])).rows[0];
    assert.deepEqual(row, { status: 'delivered', cancel_reason: null });
  });

  await test('orders need orders.manage, and me says whether the site takes orders', async () => {
    const staff = await login('nocaps');
    assert.equal((await call('GET', '/api/v1/orders', { cookie: staff.cookie })).status, 403);
    assert.equal((await call('GET', '/api/v1/auth/me', { cookie: a.cookie })).data.orders, true);
    await db.query(`update hh_sites set config = config - 'features' where id = $1`, [siteB]);
    assert.equal((await call('GET', '/api/v1/auth/me', { host: HOST_B, cookie: b.cookie })).data.orders, false);
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
