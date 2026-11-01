import { json, withAuth } from '@/lib/auth';

export const GET = withAuth(null, async (_req, ctx) =>
  json({ username: ctx.username, isOwner: ctx.isOwner, caps: ctx.caps }),
);
