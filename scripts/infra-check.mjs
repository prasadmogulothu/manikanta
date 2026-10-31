// Phase 0 proof against the real services: the app's database role is limited, and
// a signed upload to R2 displays from the public image domain.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { AwsClient } from 'aws4fetch';

for (const name of [
  'DATABASE_URL', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'NEXT_PUBLIC_IMAGE_BASE',
]) {
  if (!process.env[name]) throw new Error(`${name} is not set`);
}

const sql = neon(process.env.DATABASE_URL);
await sql`select count(*) from hh_sites`;
await assert.rejects(sql`create table infra_check_evil (id int)`, undefined, 'hh_app must not change the schema');
await assert.rejects(sql`update hh_sites set published = true`, undefined, 'hh_app must not publish sites');
await assert.rejects(sql`select * from hh_migrations`, undefined, 'hh_app must not read other tables');
const [role] = await sql`
  select rolcreaterole, rolcreatedb, rolbypassrls,
         pg_has_role(current_user, 'pg_read_all_data', 'member') as read_all,
         pg_has_role(current_user, 'pg_write_all_data', 'member') as write_all
    from pg_roles where rolname = current_user`;
assert.deepEqual(Object.values(role), [false, false, false, false, false], `hh_app has too much power: ${JSON.stringify(role)}`);
console.log('Neon: ok, the app role has only its own grants');

const { R2_ACCOUNT_ID, R2_BUCKET, NEXT_PUBLIC_IMAGE_BASE } = process.env;
const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const key = `infra-check/${randomUUID()}.txt`;
const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
const body = `infra check ${key}`;

// A signed URL, as the browser will use in Phase 5.
const signed = await r2.sign(`${objectUrl}?X-Amz-Expires=300`, {
  method: 'PUT',
  aws: { signQuery: true },
});
const put = await fetch(signed.url, { method: 'PUT', body });
assert.ok(put.ok, `R2 upload failed: ${put.status} ${await put.text()}`);

try {
  const got = await fetch(`${NEXT_PUBLIC_IMAGE_BASE.replace(/\/$/, '')}/${key}`);
  assert.ok(got.ok, `public read failed: ${got.status}`);
  assert.equal(await got.text(), body);
  console.log('R2: ok, a signed upload displays from the public domain');
} finally {
  await r2.fetch(objectUrl, { method: 'DELETE' });
}
