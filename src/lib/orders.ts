// What a customer may order, priced from saved content. Pure, with no imports, so it can
// be tested on its own and used by the server and the browser alike.

export type Pack = { label: string; price: number; offer?: number };
// price is what the customer pays; mrp is set only when an offer applied.
export type OrderLine = { title: string; title_2?: string; pack: string; price: number; mrp?: number; qty: number };
export type Order = { name: string; phone: string; address: string; items: OrderLine[]; total: number };

export class OrderError extends Error {}

export const MAX_LINES = 30;
export const MAX_QTY = 50;
const CHANGED = 'Some items changed. Please check your cart.';

const rupees = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : null;
};

const text = (v: unknown, min: number, max: number) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= min && s.length <= max ? s : null;
};

// features.orders is the platform's say (may this site take orders); orders.enabled the owner's.
export const ordersOn = (config: Record<string, any>) =>
  config?.features?.orders === true && config?.orders?.enabled === true;

export function packsOf(item: any): Pack[] {
  if (!Array.isArray(item?.packs)) return [];
  return item.packs.flatMap((p: any) => {
    const label = typeof p?.label === 'string' ? p.label.trim() : '';
    const price = rupees(p?.price);
    if (!label || !price) return [];
    const offer = rupees(p.offer);
    return [offer && offer < price ? { label, price, offer } : { label, price }];
  });
}

// Indian mobile numbers, however they were typed.
export function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function prepareOrder(config: Record<string, any>, body: unknown): Order {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new OrderError('Order must be an object');
  const b = body as Record<string, any>;
  // A hidden field people never see; bots fill it.
  if (b.website) throw new OrderError('Order refused');
  if (!ordersOn(config)) throw new OrderError('Orders are closed right now.');

  const name = text(b.name, 1, 80);
  if (!name) throw new OrderError('Please enter your name.');
  const phone = cleanPhone(b.phone);
  if (!phone) throw new OrderError('Please enter a 10-digit mobile number.');
  const address = text(b.address, 5, 300);
  if (!address) throw new OrderError('Please enter your address.');
  if (!Array.isArray(b.items) || !b.items.length) throw new OrderError('Your cart is empty.');
  if (b.items.length > MAX_LINES) throw new OrderError(`At most ${MAX_LINES} items per order.`);

  const items: OrderLine[] = [];
  for (const l of b.items) {
    const qty = l?.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new OrderError(`Choose 1 to ${MAX_QTY} of each item.`);
    const section = (config.sections || []).find(
      (s: any) => s?.enabled !== false && s?.config?.catalog && s.config.id === l.cat,
    );
    const item = (section?.config.items || []).find((it: any) => it?.enabled !== false && it?.title === l.title);
    const pack = packsOf(item).find((p) => p.label === l.pack);
    if (!pack) throw new OrderError(CHANGED);

    const same = items.find((x) => x.title === item.title && x.pack === pack.label);
    if (same) {
      same.qty = Math.min(same.qty + qty, MAX_QTY);
      continue;
    }
    items.push({
      title: item.title,
      ...(item.title_2 ? { title_2: item.title_2 } : {}),
      pack: pack.label,
      price: pack.offer ?? pack.price,
      ...(pack.offer ? { mrp: pack.price } : {}),
      qty,
    });
  }
  const total = items.reduce((sum, l) => sum + l.price * l.qty, 0);
  return { name, phone, address, items, total };
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function orderMessage(order: Order, id: number): string {
  const lines = order.items.map((l, i) => {
    const name = l.title_2 ? `${l.title} (${l.title_2})` : l.title;
    const offer = l.mrp ? ` (offer ${inr(l.price)} each, was ${inr(l.mrp)})` : '';
    return `${i + 1}. ${name} – ${l.pack} × ${l.qty} = ${inr(l.price * l.qty)}${offer}`;
  });
  return [
    `New order #${id}`,
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Address: ${order.address}`,
    '',
    ...lines,
    '',
    `Total: ${inr(order.total)}`,
  ].join('\n');
}
