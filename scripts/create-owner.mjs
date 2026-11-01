// Creates a site's owner login, or resets an owner's password if the username exists.
// Laptop only. The password comes from OWNER_PASSWORD, so it isn't left in shell history.
//   OWNER_PASSWORD=... npm run owner -- <site-slug> <username>
import { Client } from '@neondatabase/serverless';
import { hashPassword } from '../src/lib/password.ts';

const [slug, rawUsername] = process.argv.slice(2);
const password = process.env.OWNER_PASSWORD;
if (!slug || !rawUsername || !password) {
  throw new Error('Usage: OWNER_PASSWORD=... npm run owner -- <site-slug> <username>');
}
const username = rawUsername.toLowerCase();

const db = new Client(process.env.DATABASE_URL_OWNER);
await db.connect();
try {
  const { rows } = await db.query('select id from hh_sites where slug = $1', [slug]);
  if (!rows[0]) throw new Error(`No site with slug ${slug}`);
  const saved = await db.query(
    `insert into hh_users (site_id, username, password_hash, is_owner) values ($1, $2, $3, true)
     on conflict (site_id, username) do update set password_hash = excluded.password_hash, is_owner = true
     returning id`,
    [rows[0].id, username, await hashPassword(password)],
  );
  // A password reset ends every session that user had.
  await db.query('delete from hh_sessions where user_id = $1', [saved.rows[0].id]);
  console.log(`Owner ${username} is ready on ${slug}`);
} finally {
  await db.end();
}
