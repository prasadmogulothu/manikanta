import { fail, json, withAuth } from '@/lib/auth';
import { prepareContent } from '@/lib/content';
import { getContent, getVersionConfig, saveContent } from '@/lib/db';

// Restoring is a save like any other, so it can be undone too. Current platform
// settings are kept rather than brought back from the old copy.
export const POST = withAuth<{ id: string }>('content.edit', async (req, ctx, { id }) => {
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(body?.version)) return fail('Version is required', 400);
  if (!/^\d{1,18}$/.test(id)) return fail('Not found', 404);

  const old = await getVersionConfig(ctx.siteId, Number(id));
  if (!old) return fail('Not found', 404);

  const { config: current } = await getContent(ctx.siteId);
  const version = await saveContent(ctx.siteId, prepareContent(current, old), body.version, ctx.username);
  if (version === null) return fail('Someone else saved first. Please reload.', 409);
  return json({ version });
});
