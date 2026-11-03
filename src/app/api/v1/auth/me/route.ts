import { json, withAuth } from '@/lib/auth';
import { siteTakesOrders } from '@/lib/db';

// orders: may this site take orders at all, so the admin knows to offer the Orders screen.
export const GET = withAuth(null, async (_req, ctx) =>
  json({ username: ctx.username, isOwner: ctx.isOwner, caps: ctx.caps, orders: await siteTakesOrders(ctx.siteId) }),
);
