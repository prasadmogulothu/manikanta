import { useEffect, useState } from 'react';
import { inr, type OrderLine } from '../lib/orders';
import { api } from './api';

type Order = {
  id: string; name: string; phone: string; address: string; items: OrderLine[]; total: number;
  status: 'received' | 'delivered' | 'cancelled'; cancel_reason: string | null; created_at: string;
};

const STATUS_LABELS = { received: 'Received', delivered: 'Delivered', cancelled: 'Cancelled' };

// Newest first. onCount keeps the number beside the Orders menu entry current.
export default function Orders({ onCount }: { onCount: (n: number) => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  const show = (list: Order[]) => {
    setOrders(list);
    onCount(list.filter((o) => o.status === 'received').length);
  };

  useEffect(() => {
    api('GET', '/orders').then((d) => show(d.orders)).catch((e) => setError(e.message));
  }, []);

  async function setStatus(o: Order, status: Order['status']) {
    let reason: string | null = null;
    if (status === 'cancelled') {
      reason = window.prompt(`Why is order #${o.id} cancelled? The reason is kept with the order.`)?.trim() || null;
      if (!reason) return;
    }
    setError('');
    try {
      await api('PATCH', `/orders/${o.id}`, { status, reason });
      show(orders!.map((x) => (x.id === o.id ? { ...x, status, cancel_reason: reason } : x)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <h1>Orders</h1>
      <p className="muted">Newest first. Orders also reach you on WhatsApp when the customer taps Send.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {orders === null && !error && <p className="muted">Loading…</p>}
      {orders?.length === 0 && <p className="muted">No orders yet.</p>}
      {orders?.map((o) => (
        <section className={`card${o.status === 'cancelled' ? ' off' : ''}`} key={o.id}>
          <div className="row">
            <div className="row-title">
              <b>#{o.id} · {inr(o.total)}</b>
              <small>{new Date(o.created_at).toLocaleString()}</small>
            </div>
            <label className="order-status">
              <span className="sr-only">Status of order {o.id}</span>
              <select value={o.status} onChange={(e) => setStatus(o, e.target.value as Order['status'])}>
                {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          </div>
          {o.cancel_reason && <p className="warn">Cancelled: {o.cancel_reason}</p>}
          <p>
            <b>{o.name}</b> · <a href={`tel:+91${o.phone}`}>{o.phone}</a><br />
            {o.address}
          </p>
          <ul className="order-lines">
            {o.items.map((l, i) => (
              <li key={i}>
                <span>{l.title}{l.title_2 ? ` (${l.title_2})` : ''} – {l.pack} × {l.qty}{l.mrp ? ` (offer ${inr(l.price)} each, was ${inr(l.mrp)})` : ''}</span>
                <b>{inr(l.price * l.qty)}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
