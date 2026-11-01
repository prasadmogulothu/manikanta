import { fail, json, withAuth } from '@/lib/auth';
import { ContentError, prepareContent } from '@/lib/content';
import { getContent, saveContent } from '@/lib/db';

export const GET = withAuth('content.edit', async (_req, ctx) => json(await getContent(ctx.siteId)));

export const PUT = withAuth('content.edit', async (req, ctx) => {
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(body?.version)) return fail('Version is required', 400);

  const { config: current } = await getContent(ctx.siteId);
  let config;
  try {
    config = prepareContent(current, body.config);
  } catch (err) {
    if (err instanceof ContentError) return fail(err.message, 400);
    throw err;
  }

  const version = await saveContent(ctx.siteId, config, body.version, ctx.username);
  if (version === null) return fail('Someone else saved first. Please reload.', 409);
  return json({ version });
});
