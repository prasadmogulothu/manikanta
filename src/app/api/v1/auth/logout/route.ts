import { clearCookie, json, withAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export const POST = withAuth(null, async (_req, ctx) => {
  await query('delete from hh_sessions where token_hash = $1 and user_id = $2', [ctx.tokenHash, ctx.userId]);
  return json({ ok: true }, 200, clearCookie());
});
