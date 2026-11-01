import { fail, json, startSession, withAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { MIN_PASSWORD, validPassword } from '@/lib/users';

export const POST = withAuth(null, async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const { current, next } = body ?? {};
  if (typeof current !== 'string' || typeof next !== 'string') return fail('Enter both passwords', 400);
  if (!validPassword(next)) return fail(`Use at least ${MIN_PASSWORD} characters`, 400);

  const [user] = await query('select password_hash from hh_users where id = $1 and site_id = $2', [ctx.userId, ctx.siteId]);
  if (!user || !(await verifyPassword(current, user.password_hash))) return fail('Current password is wrong', 403);

  await query('update hh_users set password_hash = $1 where id = $2 and site_id = $3', [await hashPassword(next), ctx.userId, ctx.siteId]);
  // Ends every session, including any on a lost phone. This device gets a new one.
  await query('delete from hh_sessions where user_id = $1', [ctx.userId]);
  const { headers } = await startSession(ctx.userId);
  return json({ ok: true }, 200, headers);
});
