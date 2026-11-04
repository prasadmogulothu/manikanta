import { fail, json, requestHost, requestIp, sameOrigin } from '@/lib/auth';
import { getContent, getSiteIdByHost, insertOrder, recentOrderCount, recentSiteOrderCount } from '@/lib/db';
import { OrderError, alertUrl, ipBucket, orderMessage, ordersOn, prepareOrder } from '@/lib/orders';

const MAX_PER_HOUR = 5;
// However many connections a flood comes from, real orders stay near the top of the list.
const MAX_PER_SITE_HOUR = 60;

// The second public route: a customer placing an order from the site's cart. The site
// comes from the address and every price from saved content, never from the request.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Request refused', 403);
  const siteId = await getSiteIdByHost(requestHost(req));
  if (!siteId) return fail('Not found', 404);

  const { config } = await getContent(siteId);
  if (!ordersOn(config)) return fail('Orders are closed right now.', 403);
  const ip = ipBucket(requestIp(req));
  if ((await recentOrderCount(siteId, ip)) >= MAX_PER_HOUR) return fail('Too many orders. Please call the shop.', 429);
  if ((await recentSiteOrderCount(siteId)) >= MAX_PER_SITE_HOUR) return fail('Too many orders right now. Please call the shop.', 429);

  let order;
  try {
    order = prepareOrder(config, await req.json().catch(() => null));
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message, 400);
    throw err;
  }
  const id = Number(await insertOrder(siteId, order, ip));
  // The order is saved either way; if the message doesn't go, the customer gets the WhatsApp button instead.
  const url = alertUrl(config.contact?.whatsapp, process.env.CALLMEBOT_KEYS, orderMessage(order, id));
  const sent = !!url && (await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.ok, () => false));
  return json({ id, order, sent });
}
