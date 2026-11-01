import { fail, json, withAuth } from '@/lib/auth';
import { query, rolesBelongToSite } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { MIN_PASSWORD, validPassword, validRoleIds, validUserId } from '@/lib/users';

// The site check is here, so another site's user reads as not found. An owner is only
// ever changed from the laptop script, so nobody with users.manage can take over.
// ponytail: users.manage can grant any capability in its own site, itself included.
// It's the trusted-manager role. Limit it to the caller's own caps if shops need that.
async function staffOnly(siteId: string, id: string) {
  if (!validUserId(id)) return fail('Not found', 404);
  const [user] = await query('select is_owner from hh_users where id = $1 and site_id = $2', [id, siteId]);
  if (!user) return fail('Not found', 404);
  if (user.is_owner) return fail("The owner's account can't be changed here", 403);
  return null;
}

export const PATCH = withAuth<{ id: string }>('users.manage', async (req, ctx, { id }) => {
  const refused = await staffOnly(ctx.siteId, id);
  if (refused) return refused;

  const { password, roleIds } = (await req.json().catch(() => null)) ?? {};
  if (password !== undefined) {
    if (id === ctx.userId) return fail('Change your own password on the Password screen', 400);
    if (!validPassword(password)) return fail(`Use at least ${MIN_PASSWORD} characters`, 400);
  }
  if (roleIds !== undefined && (!validRoleIds(roleIds) || !(await rolesBelongToSite(ctx.siteId, roleIds)))) {
    return fail('Unknown role', 400);
  }

  if (password !== undefined) {
    await query('update hh_users set password_hash = $1 where id = $2 and site_id = $3', [await hashPassword(password), id, ctx.siteId]);
    await query('delete from hh_sessions where user_id = $1', [id]);
  }
  if (roleIds !== undefined) {
    // One statement, so a failure can't leave the user with no roles.
    await query(
      `with gone as (
         delete from hh_user_roles where site_id = $1 and user_id = $2 and role_id <> all($3::bigint[])
       )
       insert into hh_user_roles (site_id, user_id, role_id)
       select $1, $2, id from hh_roles where site_id = $1 and id = any($3::bigint[])
       on conflict do nothing`,
      [ctx.siteId, id, roleIds],
    );
  }
  return json({ ok: true });
});

export const DELETE = withAuth<{ id: string }>('users.manage', async (_req, ctx, { id }) => {
  if (id === ctx.userId) return fail("You can't remove yourself", 400);
  const refused = await staffOnly(ctx.siteId, id);
  if (refused) return refused;
  // Sessions and role links go with it. History keeps the username as text.
  await query('delete from hh_users where id = $1 and site_id = $2', [id, ctx.siteId]);
  return json({ ok: true });
});
