import { fail, json, withAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { cleanRoleName, validCaps } from '@/lib/users';

export const GET = withAuth('users.manage', async (_req, ctx) =>
  json({
    roles: await query(
      `select r.id::text as id, r.name, r.caps,
              (select count(*)::int from hh_user_roles ur where ur.role_id = r.id) as users
         from hh_roles r
        where r.site_id = $1
        order by r.name`,
      [ctx.siteId],
    ),
  }),
);

export const POST = withAuth('users.manage', async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const name = cleanRoleName(body?.name);
  if (!name) return fail('Give the role a name', 400);
  if (!validCaps(body?.caps)) return fail('Unknown capability', 400);

  const [role] = await query(
    `insert into hh_roles (site_id, key, name, caps) values ($1, $2, $3, $4)
     on conflict (site_id, key) do nothing
     returning id::text as id`,
    [ctx.siteId, name.toLowerCase(), name, body.caps],
  );
  if (!role) return fail('A role with that name already exists', 409);
  return json({ id: role.id }, 201);
});
