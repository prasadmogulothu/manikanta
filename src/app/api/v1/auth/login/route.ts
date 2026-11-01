import { clearFailures, fail, isLocked, json, recordFailure, requestHost, requestIp, startSession } from '@/lib/auth';
import { getSiteIdByHost, query } from '@/lib/db';
import { DUMMY_HASH, verifyPassword } from '@/lib/password';

const WRONG = 'Wrong username or password';

// The one public admin route. The site comes from the address, so the same username
// can exist on two sites.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 100 || password.length > 200) return fail(WRONG, 401);

  const siteId = await getSiteIdByHost(requestHost(req));
  if (!siteId) return fail(WRONG, 401);

  const ip = requestIp(req);
  if (await isLocked(siteId, username, ip)) return fail('Too many tries. Please wait 15 minutes.', 429);

  const [user] = await query('select id, password_hash from hh_users where site_id = $1 and username = $2', [siteId, username]);
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordFailure(siteId, username, ip);
    return fail(WRONG, 401);
  }

  await clearFailures(siteId, username, ip);
  const { token, headers } = await startSession(user.id);
  // The token in the body is for the mobile app, which can't read the cookie.
  return json({ token }, 200, headers);
}
