import { fail, json, withAuth } from '@/lib/auth';
import { setOrderStatus } from '@/lib/db';

const STATUSES = ['received', 'delivered', 'cancelled'];

// A cancelled order keeps its reason; any other status clears it.
export const PATCH = withAuth<{ id: string }>('orders.manage', async (req, ctx, { id }) => {
  if (!/^\d{1,18}$/.test(id)) return fail('Not found', 404);
  const body = await req.json().catch(() => null);
  if (!STATUSES.includes(body?.status)) return fail('Unknown status', 400);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (body.status === 'cancelled' && (!reason || reason.length > 200)) return fail('Give a reason for cancelling', 400);

  const found = await setOrderStatus(ctx.siteId, id, body.status, body.status === 'cancelled' ? reason : null);
  if (!found) return fail('Not found', 404);
  return json({ ok: true });
});
