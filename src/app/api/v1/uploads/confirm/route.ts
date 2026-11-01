import { fail, json, withAuth } from '@/lib/auth';
import { getSiteSlug } from '@/lib/db';
import { deleteUpload, ownsKey, verifyUpload } from '@/lib/uploads';

export const POST = withAuth('content.edit', async (req, ctx) => {
  const body = await req.json().catch(() => null);
  if (!ownsKey(await getSiteSlug(ctx.siteId), body?.key)) return fail('Request refused', 403);

  const ok = await verifyUpload(body.key);
  if (ok === null) return fail('The photo did not arrive. Please try again.', 404);
  if (!ok) {
    await deleteUpload(body.key);
    return fail('That file is not a valid photo', 400);
  }
  return json({ key: body.key });
});
