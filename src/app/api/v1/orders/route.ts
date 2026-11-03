import { json, withAuth } from '@/lib/auth';
import { listOrders } from '@/lib/db';

export const GET = withAuth('orders.manage', async (_req, ctx) => json({ orders: await listOrders(ctx.siteId) }));
