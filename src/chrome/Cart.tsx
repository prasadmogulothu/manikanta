'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_QTY, cleanPhone, inr, orderMessage, refreshLines, type Order, type Pack } from '../lib/orders';
import { asset } from '../lib/links';
import type { Site } from '../lib/types';

// The cart, shown only while the site takes orders. Product cards carry a data-add
// button; one listener here opens the pack picker, so the cards stay server-rendered.

type Line = { cat: string; title: string; title_2?: string; pack: string; price: number; mrp?: number; qty: number };
type Pick = { cat: string; title: string; title_2?: string; packs: Pack[] };
type Customer = { name: string; phone: string; address: string };

const LABELS = {
  te: {
    cart: 'కార్ట్', add: 'కార్ట్‌లో వేయండి', qty: 'సంఖ్య', less: 'తగ్గించు', more: 'పెంచు', remove: 'తీసివేయండి',
    close: 'మూసివేయండి', empty: 'కార్ట్ ఖాళీగా ఉంది.', total: 'మొత్తం', send: 'ఆర్డర్ పంపండి', back: 'వెనక్కి',
    name: 'పేరు', phone: 'మొబైల్ నంబర్', address: 'చిరునామా', submit: 'ఆర్డర్ సమర్పించండి', sending: 'పంపుతోంది…',
    badPhone: '10 అంకెల మొబైల్ నంబర్ ఇవ్వండి.', failed: 'ఆర్డర్ పంపలేకపోయాం. మళ్ళీ ప్రయత్నించండి.',
    saved: 'ఆర్డర్ నమోదైంది', whatsapp: 'WhatsAppలో షాపుకు పంపండి', pdf: 'PDF సేవ్ చేయండి',
    hint: 'WhatsApp తెరుచుకున్నాక Send నొక్కండి.', privacy: 'మీ వివరాలు షాపు ఆర్డర్ రికార్డుల్లో ఉంటాయి, డెలివరీ కోసమే.', privacyLink: 'గోప్యతా విధానం',
  },
  en: {
    cart: 'Cart', add: 'Add to cart', qty: 'How many', less: 'One less', more: 'One more', remove: 'Remove',
    close: 'Close', empty: 'Your cart is empty.', total: 'Total', send: 'Send order', back: 'Back',
    name: 'Name', phone: 'Mobile number', address: 'Address', submit: 'Submit order', sending: 'Sending…',
    badPhone: 'Please enter a 10-digit mobile number.', failed: "Couldn't send the order. Please try again.",
    saved: 'Order saved', whatsapp: 'Send it to the shop on WhatsApp', pdf: 'Save PDF',
    hint: 'When WhatsApp opens, tap Send.', privacy: "Your details are kept in the shop's order records, only for delivery.", privacyLink: 'Privacy',
  },
};

// Browser storage can be missing or blocked; the cart then lasts until the page closes.
function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const same = (a: Line, b: { cat: string; title: string; pack: string }) => a.cat === b.cat && a.title === b.title && a.pack === b.pack;
const name2 = (l: { title: string; title_2?: string }) => (l.title_2 ? `${l.title} (${l.title_2})` : l.title);
const Price = ({ price, mrp }: { price: number; mrp?: number }) =>
  mrp ? <><s>{inr(mrp)}</s> <b className="offer">{inr(price)}</b></> : <b>{inr(price)}</b>;

export default function Cart({ site }: { site: Site }) {
  const t = site.config.lang === 'te' ? LABELS.te : LABELS.en;
  const whatsapp = String(site.config.contact?.whatsapp || '').replace(/\D/g, '');
  const note: string = site.config.orders?.note || '';

  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '' });
  const [pick, setPick] = useState<Pick | null>(null);
  const [pack, setPack] = useState(0);
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<'cart' | 'form' | 'done'>('cart');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ id: number; order: Order } | null>(null);
  const picker = useRef<HTMLDialogElement>(null);
  const cart = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // Products may have changed since the cart was saved; the page's Add buttons say how they are now.
    const live = [...document.querySelectorAll('[data-add]')].flatMap((b) => {
      try { return [JSON.parse(b.getAttribute('data-add') || '')]; } catch { return []; }
    });
    const fresh = refreshLines(load<unknown>('hh-cart', []), live);
    setLines(fresh);
    save('hh-cart', fresh);
    setCustomer({ name: '', phone: '', address: '', ...load<Partial<Customer>>('hh-customer', {}) });

    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element).closest?.('[data-add]');
      if (!button) return;
      try {
        setPick(JSON.parse(button.getAttribute('data-add') || ''));
        setPack(0);
        setQty(1);
        picker.current?.showModal();
      } catch {}
    };
    document.addEventListener('click', onClick);
    const done = () => document.body.classList.remove('printing-receipt');
    window.addEventListener('afterprint', done);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('afterprint', done);
    };
  }, []);

  const update = (next: Line[]) => {
    setLines(next);
    save('hh-cart', next);
  };
  const setLineQty = (l: Line, n: number) =>
    update(n < 1 ? lines.filter((x) => x !== l) : lines.map((x) => (x === l ? { ...x, qty: Math.min(n, MAX_QTY) } : x)));

  function addPicked() {
    if (!pick) return;
    const p = pick.packs[pack];
    const line: Line = {
      cat: pick.cat, title: pick.title, title_2: pick.title_2, pack: p.label,
      price: p.offer ?? p.price, ...(p.offer ? { mrp: p.price } : {}), qty,
    };
    const existing = lines.find((l) => same(l, line));
    update(existing ? lines.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) } : l)) : [...lines, line]);
    picker.current?.close();
  }

  function openCart() {
    setStep(lines.length ? 'cart' : placed ? 'done' : 'cart');
    setError('');
    cart.current?.showModal();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!cleanPhone(customer.phone)) return setError(t.badPhone);
    setBusy(true);
    setError('');
    save('hh-customer', customer);
    try {
      const res = await fetch('/api/v1/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...customer,
          website: new FormData(e.currentTarget).get('website'),
          items: lines.map(({ cat, title, pack, qty, price }) => ({ cat, title, pack, qty, price })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t.failed);
      setPlaced(data);
      update([]);
      setStep('done');
    } catch (err: any) {
      setError(err.message || t.failed);
    } finally {
      setBusy(false);
    }
  }

  function savePdf() {
    document.body.classList.add('printing-receipt');
    window.print();
  }

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const chosen = pick?.packs[pack];
  // The customer's copy opens by itself once the order is saved (the browser's own Save as PDF sheet).
  useEffect(() => {
    if (placed) requestAnimationFrame(savePdf);
  }, [placed]);

  const b = site.config.brand || {};
  const waLink = placed && whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(orderMessage(placed.order, placed.id))}` : '';

  return (
    <>
      {(count > 0 || placed) && (
        <button type="button" className="cart-fab" onClick={openCart} aria-label={`${t.cart}: ${count}`}>
          {t.cart} <span className="cart-count">{count}</span>
        </button>
      )}

      <dialog className="cart" ref={picker} aria-label={pick ? name2(pick) : t.add}>
        {pick && chosen && (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); addPicked(); }}>
            <h2>{name2(pick)}</h2>
            <fieldset className="cart-packs">
              {pick.packs.map((p, i) => (
                <label key={p.label}>
                  <input type="radio" name="pack" checked={i === pack} onChange={() => setPack(i)} />
                  <span>{p.label}</span> <Price price={p.offer ?? p.price} mrp={p.offer ? p.price : undefined} />
                </label>
              ))}
            </fieldset>
            <div className="cart-qty" role="group" aria-label={t.qty}>
              <button type="button" aria-label={t.less} disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
              <output>{qty}</output>
              <button type="button" aria-label={t.more} disabled={qty >= MAX_QTY} onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <div className="cart-actions">
              <button type="button" className="cart-link" onClick={() => picker.current?.close()}>{t.close}</button>
              <button type="submit" className="cart-go">{t.add} · {inr((chosen.offer ?? chosen.price) * qty)}</button>
            </div>
          </form>
        )}
      </dialog>

      <dialog className="cart" ref={cart} aria-label={t.cart}>
        <button type="button" className="cart-x" aria-label={t.close} onClick={() => cart.current?.close()}>&times;</button>

        {step === 'cart' && (
          <>
            <h2>{t.cart}</h2>
            {lines.length === 0 && <p>{t.empty}</p>}
            <ul className="cart-lines">
              {lines.map((l) => (
                <li key={`${l.cat}|${l.title}|${l.pack}`}>
                  <div>
                    <b>{name2(l)}</b>
                    <small>{l.pack} · <Price price={l.price} mrp={l.mrp} /></small>
                  </div>
                  <div className="cart-qty" role="group" aria-label={t.qty}>
                    <button type="button" aria-label={l.qty > 1 ? t.less : t.remove} onClick={() => setLineQty(l, l.qty - 1)}>−</button>
                    <output>{l.qty}</output>
                    <button type="button" aria-label={t.more} disabled={l.qty >= MAX_QTY} onClick={() => setLineQty(l, l.qty + 1)}>+</button>
                  </div>
                </li>
              ))}
            </ul>
            {lines.length > 0 && (
              <>
                <p className="cart-total">{t.total}: <b>{inr(total)}</b></p>
                {note && <p className="cart-note">{note}</p>}
                <button type="button" className="cart-go" onClick={() => setStep('form')}>{t.send}</button>
              </>
            )}
          </>
        )}

        {step === 'form' && (
          <form onSubmit={submit}>
            <h2>{t.send}</h2>
            <label>{t.name}
              <input required maxLength={80} autoComplete="name" value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </label>
            <label>{t.phone}
              <input required type="tel" inputMode="tel" autoComplete="tel" maxLength={16} value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </label>
            <label>{t.address}
              <textarea required minLength={5} maxLength={300} rows={3} autoComplete="street-address" value={customer.address}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            </label>
            {/* Hidden from people; a bot that fills it is refused. */}
            <label className="cart-hp" aria-hidden="true">Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
            {note && <p className="cart-note">{note}</p>}
            <p className="cart-small">{t.privacy} <a href="/privacy" target="_blank" rel="noopener">{t.privacyLink}</a></p>
            {error && <p className="cart-error" role="alert">{error}</p>}
            <p className="cart-total">{t.total}: <b>{inr(total)}</b></p>
            <div className="cart-actions">
              <button type="button" className="cart-link" onClick={() => setStep('cart')}>{t.back}</button>
              <button type="submit" className="cart-go" disabled={busy}>{busy ? t.sending : t.submit}</button>
            </div>
          </form>
        )}

        {step === 'done' && placed && (
          <>
            <div className="receipt">
              <div className="receipt-brand">
                {b.logo && <img src={asset(b.logo)} alt="" />}
                <div>
                  <b>{b.wordmark || b.name || site.name}{b.wordmark_accent && <em> {b.wordmark_accent}</em>}</b>
                  {b.tagline && <small>{b.tagline}</small>}
                </div>
              </div>
              <h2>{t.saved} #{placed.id}</h2>
              <p>{new Date().toLocaleString('en-IN')}</p>
              <p>{placed.order.name}<br />{placed.order.phone}<br />{placed.order.address}</p>
              <ul className="cart-lines">
                {placed.order.items.map((l) => (
                  <li key={`${l.title}|${l.pack}`}>
                    <div>
                      <b>{name2(l)}</b>
                      <small>{l.pack} × {l.qty} · <Price price={l.price} mrp={l.mrp} /></small>
                    </div>
                    <b>{inr(l.price * l.qty)}</b>
                  </li>
                ))}
              </ul>
              <p className="cart-total receipt-total">{t.total}: <b>{inr(placed.order.total)}</b></p>
            </div>
            {waLink && <a className="cart-go" href={waLink} target="_blank" rel="noopener">{t.whatsapp}</a>}
            {waLink && <p className="cart-small">{t.hint}</p>}
            <button type="button" className="cart-link" onClick={savePdf}>{t.pdf}</button>
          </>
        )}
      </dialog>
    </>
  );
}

export const classes = [
  'cart-fab', 'cart-count', 'cart', 'cart-packs', 'cart-qty', 'cart-actions', 'cart-link', 'cart-go', 'cart-x',
  'cart-lines', 'cart-total', 'cart-note', 'cart-hp', 'cart-small', 'cart-error', 'receipt', 'receipt-brand', 'receipt-total',
];
