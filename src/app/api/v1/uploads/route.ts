import { fail, json, withAuth } from '@/lib/auth';
import { getSiteSlug } from '@/lib/db';
import { MAX_UPLOAD_BYTES, allowedType, keyFor, signUpload } from '@/lib/uploads';

export const POST = withAuth('content.edit', async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const size = body?.size;
  if (!allowedType(body?.type)) return fail('Only WebP and JPEG photos can be uploaded', 400);
  if (!Number.isInteger(size) || size <= 0) return fail('The photo is empty', 400);
  if (size > MAX_UPLOAD_BYTES) return fail('That photo is too large', 413);
  return json(await signUpload(keyFor(await getSiteSlug(ctx.siteId), body.type), body.type, size));
});
