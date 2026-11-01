import { fail, json, withAuth } from '@/lib/auth';
import { query, rolesBelongToSite } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { MIN_PASSWORD, cleanUsername, validPassword, validRoleIds } from '@/lib/users';

export const GET = withAuth('users.manage', async (_req, ctx) =>
  json({
    users: await query(
      `select u.id, u.username, u.is_owner,
              array_remove(array_agg(ur.role_id::text), null) as role_ids
         from hh_users u
         left join hh_user_roles ur on ur.user_id = u.id
        where u.site_id = $1
        group by u.id
        order by u.is_owner desc, u.username`,
      [ctx.siteId],
    ),
  }),
);

export const POST = withAuth('users.manage', async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const username = cleanUsername(body?.username);
  const roleIds = body?.roleIds ?? [];
  if (!username) return fail('Use 2 to 50 letters, numbers, dots or dashes for the username', 400);
  if (!validPassword(body?.password)) return fail(`Use at least ${MIN_PASSWORD} characters for the password`, 400);
  if (!validRoleIds(roleIds) || !(await rolesBelongToSite(ctx.siteId, roleIds))) return fail('Unknown role', 400);

  const [user] = await query(
    `with u as (
       insert into hh_users (site_id, username, password_hash) values ($1, $2, $3)
       on conflict (site_id, username) do nothing
       returning id
     ), r as (
       insert into hh_user_roles (site_id, user_id, role_id)
       select $1, u.id, x.id from u, hh_roles x where x.site_id = $1 and x.id = any($4::bigint[])
     )
     select id from u`,
    [ctx.siteId, username, await hashPassword(body.password), roleIds],
  );
  if (!user) return fail('That username is already taken', 409);
  return json({ id: user.id }, 201);
});
