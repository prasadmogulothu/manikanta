// Runs the migrations on an in-process Postgres and proves the rules they promise.
// Needs no accounts, so it can run in `npm run check`.
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate.mjs';

const db = new PGlite();
const client = {
  // exec handles many statements in one string; query handles parameters.
  query: async (sql, params) =>
    params ? db.query(sql, params) : (await db.exec(sql)).at(-1),
};
const refused = (sql, why) => assert.rejects(db.exec(sql), undefined, why);

const applied = await migrate(client);
assert.ok(applied.length > 0, 'first run applies migrations');
assert.deepEqual(await migrate(client), [], 'second run applies nothing');

await db.exec(`
  insert into hh_templates (key, name) values ('t', 'T');
  insert into hh_sites (id, slug, name, template_key) values
    ('00000000-0000-0000-0000-00000000000a', 'site-a', 'A', 't'),
    ('00000000-0000-0000-0000-00000000000b', 'site-b', 'B', 't');
  insert into hh_users (id, site_id, username, password_hash) values
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'staff', 'x');
  insert into hh_roles (site_id, key, name, caps) values
    ('00000000-0000-0000-0000-00000000000a', 'editor', 'Editor', '{content.edit}'),
    ('00000000-0000-0000-0000-00000000000b', 'editor', 'Editor', '{content.edit}');
`);

const A = "'00000000-0000-0000-0000-00000000000a'";
const B = "'00000000-0000-0000-0000-00000000000b'";
const USER = "'00000000-0000-0000-0000-0000000000a1'";

await refused(
  `insert into hh_user_roles (site_id, user_id, role_id) values (${B}, ${USER}, 2)`,
  "a user can't take a role from another site",
);
await refused(
  `insert into hh_user_roles (site_id, user_id, role_id) values (${A}, ${USER}, 2)`,
  "a role from another site can't be claimed by naming the user's site",
);
await db.exec(`insert into hh_user_roles (site_id, user_id, role_id) values (${A}, ${USER}, 1)`);
await refused(`insert into hh_roles (site_id, key, name, caps) values (${A}, 'x', 'X', '{content.edti}')`, 'unknown capability');
await refused(`insert into hh_users (site_id, username, password_hash) values (${A}, 'Staff', 'x')`, 'username must be lower case');
await refused(`insert into hh_sites (slug, name, template_key) values ('../evil', 'E', 't')`, 'slug must be safe in a path');

// Everything below runs as the role Vercel uses.
await db.exec('set role hh_app');
await db.exec(`update hh_sites set config = '{"a":1}', updated_at = now() where id = ${A}`);
await db.exec(`insert into hh_site_versions (site_id, config, saved_by) values (${A}, '{}', 'staff')`);
await db.exec(`insert into hh_roles (site_id, key, name) values (${A}, 'helper', 'Helper')`);
await db.exec(`insert into hh_sessions (token_hash, user_id, expires_at) values ('h', ${USER}, now())`);
await db.exec(`delete from hh_site_versions where site_id = ${A}`);

for (const [sql, why] of [
  ['create table evil (id int)', 'no schema changes'],
  ['drop table hh_sites', 'no dropping tables'],
  ['alter table hh_users add column x int', 'no altering tables'],
  ['select * from hh_migrations', 'no migration table'],
  [`update hh_sites set template_key = 't', hostnames = '{evil.com}'`, 'no platform columns'],
  [`update hh_sites set published = true`, 'no publishing'],
  [`update hh_site_versions set config = '{}'`, 'no rewriting history'],
  [`insert into hh_sites (slug, name, template_key) values ('new', 'N', 't')`, 'no creating sites'],
  [`delete from hh_sites`, 'no deleting sites'],
  [`insert into hh_templates (key, name) values ('n', 'N')`, 'no changing templates'],
]) {
  await refused(sql, why);
}

await db.close();
console.log('migrate.check: ok');
