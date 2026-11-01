import { createHash, randomBytes } from 'node:crypto';
import { query } from './db';
import { hostFromHeader } from './links';

const COOKIE = 'hh_session';
const SESSION_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
// Across every username, so one address can't try a common password on many accounts.
const MAX_IP_FAILURES = 30;

export type AuthContext = {
  siteId: string;
  userId: string;
  username: string;
  isOwner: boolean;
  caps: string[];
  tokenHash: string;
};

type Handler<P> = (req: Request, ctx: AuthContext, params: P) => Promise<Response>;

export const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });
export const fail = (error: string, status: number) => json({ error }, status);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const requestHost = (req: Request) => hostFromHeader(req.headers.get('host'));

// Vercel sets this itself, so a visitor can't choose their own lockout bucket.
export const requestIp = (req: Request) => req.headers.get('x-real-ip') || 'unknown';

const cookieHeader = (value: string, maxAge: number) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const clearCookie = () => ({ 'Set-Cookie': cookieHeader('', 0) });

export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into hh_sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS],
  );
  return { token, headers: { 'Set-Cookie': cookieHeader(token, SESSION_DAYS * 86400) } };
}

function readToken(req: Request) {
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return { token: bearer, viaCookie: false };
  const cookie = req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return { token: cookie, viaCookie: true };
}

// A browser sends Origin on every write. Missing or foreign means it isn't our page.
function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

// The only way into an admin route: site_id comes from the session, never the request.
// cap = null means any signed-in user. A route file that doesn't use this fails the
// check in scripts/modules.check.mjs.
export function withAuth<P = unknown>(cap: string | null, handler: Handler<P>) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const { token, viaCookie } = readToken(req);
    if (!token) return fail('Please sign in', 401);
    if (viaCookie && !['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) return fail('Request refused', 403);

    const rows = await query(
      `select u.id, u.site_id, u.username, u.is_owner, s.hostnames,
              coalesce((select array_agg(distinct c)
                          from hh_user_roles ur
                          join hh_roles r on r.id = ur.role_id
                          cross join unnest(r.caps) c
                         where ur.user_id = u.id), '{}') as caps
         from hh_sessions x
         join hh_users u on u.id = x.user_id
         join hh_sites s on s.id = u.site_id
        where x.token_hash = $1 and x.expires_at > now()`,
      [hashToken(token)],
    );
    const user = rows[0];
    if (!user) return fail('Please sign in', 401);
    // A browser session belongs to its own site's address. The mobile app's Bearer
    // token has no site address, and still only ever reaches its own site's rows.
    if (viaCookie && !user.hostnames.includes(requestHost(req))) return fail('Request refused', 403);
    if (cap && !user.is_owner && !user.caps.includes(cap)) return fail('You do not have access to this', 403);

    return handler(
      req,
      {
        siteId: user.site_id,
        userId: user.id,
        username: user.username,
        isOwner: user.is_owner,
        caps: user.caps,
        tokenHash: hashToken(token),
      },
      await route.params,
    );
  };
}

export async function isLocked(siteId: string, username: string, ip: string) {
  const [row] = await query(
    `select exists (select 1 from hh_login_attempts
                     where site_id = $1 and username = $2 and ip = $3 and locked_until > now())
         or (select coalesce(sum(failures), 0) from hh_login_attempts
              where ip = $3 and updated_at > now() - make_interval(mins => $4)) >= $5 as locked`,
    [siteId, username, ip, LOCK_MINUTES, MAX_IP_FAILURES],
  );
  return row.locked as boolean;
}

export const recordFailure = async (siteId: string, username: string, ip: string) => {
  // Every made-up username adds a row, so old ones are cleared as new ones arrive.
  await query(`delete from hh_login_attempts where updated_at < now() - interval '7 days'`);
  return query(
    `insert into hh_login_attempts as a (site_id, username, ip, failures)
     values ($1, $2, $3, 1)
     on conflict (site_id, username, ip) do update set
       failures = case when a.locked_until <= now() then 1 else a.failures + 1 end,
       locked_until = case
         when a.locked_until <= now() then null
         when a.failures + 1 >= $4 then now() + make_interval(mins => $5)
         else a.locked_until end,
       updated_at = now()`,
    [siteId, username, ip, MAX_FAILURES, LOCK_MINUTES],
  );
};

export const clearFailures = (siteId: string, username: string, ip: string) =>
  query('delete from hh_login_attempts where site_id = $1 and username = $2 and ip = $3', [siteId, username, ip]);
