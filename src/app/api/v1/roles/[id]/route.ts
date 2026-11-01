import { fail, json, withAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { cleanRoleName, validCaps } from '@/lib/users';

export const PATCH = withAuth<{ id: string }>('users.manage', async (req, ctx, { id }) => {
  if (!/^\d{1,18}$/.test(id)) return fail('Not found', 404);
  const body = await req.json().catch(() => null);
  const name = cleanRoleName(body?.name);
  if (!name) return fail('Give the role a name', 400);
  if (!validCaps(body?.caps)) return fail('Unknown capability', 400);

  try {
    const rows = await query(
      'update hh_roles set key = $1, name = $2, caps = $3 where id = $4 and site_id = $5 returning id',
      [name.toLowerCase(), name, body.caps, id, ctx.siteId],
    );
    if (!rows[0]) return fail('Not found', 404);
  } catch (err: any) {
    if (err?.code === '23505') return fail('A role with that name already exists', 409);
    throw err;
  }
  return json({ ok: true });
});

// Users who held it stay, without its capabilities.
export const DELETE = withAuth<{ id: string }>('users.manage', async (_req, ctx, { id }) => {
  if (!/^\d{1,18}$/.test(id)) return fail('Not found', 404);
  const rows = await query('delete from hh_roles where id = $1 and site_id = $2 returning id', [id, ctx.siteId]);
  if (!rows[0]) return fail('Not found', 404);
  return json({ ok: true });
});
