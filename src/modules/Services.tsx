import { asset } from '../lib/links';
import { inr, ordersOn, packsOf } from '../lib/orders';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';
import { Icon } from './icons';

// Also holds products: a category is a section with `catalog: true`, a product an item.
// An item may carry a photo or an icon, so a site without photos still looks finished.
export default function Services({ c, site }: ModuleProps) {
  const items: any[] = (c.items || []).filter((it: any) => it.enabled !== false);
  const showPrices = site.config.show_prices !== false;
  const canOrder = ordersOn(site.config);
  const addLabel = site.config.lang === 'te' ? 'కార్ట్‌లో వేయండి' : 'Add to cart';
  return (
    <Section c={c}>
      <div className="cards" style={{ '--cols': +c.columns || 3 } as React.CSSProperties}>
        {items.map((it, i) => {
          // No price, or prices switched off: no tag at all, not an empty one.
          const amount = showPrices && it.amount?.trim();
          const tag = amount ? <span className="amount">{amount}</span> : null;
          const packs = packsOf(it);
          // Chrome's Cart listens for clicks on data-add, so this stays a server component.
          const data = canOrder && packs.length > 0 ? JSON.stringify({ cat: c.id, title: it.title, title_2: it.title_2, packs }) : null;
          const hasFigure = !!(it.image || it.icon);
          // On a photo: a cart icon at its bottom-right corner. Without one: a text button.
          const cartIcon = data && hasFigure && (
            <button type="button" className="add-icon" data-add={data} aria-label={`${addLabel}: ${it.title || ''}`}>
              <Icon name="cart" size={22} />
            </button>
          );
          return (
          <article className="card" key={i}>
            {it.image ? (
              <figure>
                <img
                  src={asset(it.image)}
                  alt={it.alt || ''}
                  loading="lazy"
                  className={it.fit === 'contain' ? 'fit-contain' : undefined}
                />
                {tag}
                {cartIcon}
              </figure>
            ) : it.icon ? (
              <figure>
                <Icon name={it.icon} size={56} />
                {tag}
                {cartIcon}
              </figure>
            ) : (
              tag
            )}
            <h3>{it.title}</h3>
            {it.title_2 && <p className="t2">{it.title_2}</p>}
            {it.body && <p>{it.body}</p>}
            {it.price && <span className="price">{it.price}</span>}
            {showPrices && packs.length > 0 && (
              <ul className="packs">
                {packs.map((p) => (
                  <li key={p.label}>
                    {p.label}{' '}
                    {p.offer ? <><s>{inr(p.price)}</s> <b className="offer">{inr(p.offer)}</b></> : <b>{inr(p.price)}</b>}
                  </li>
                ))}
              </ul>
            )}
            {data && !hasFigure && <button type="button" className="add" data-add={data}>{addLabel}</button>}
          </article>
          );
        })}
      </div>
    </Section>
  );
}

export const classes = ['cards', 'card', 'price', 't2', 'fit-contain', 'amount', 'packs', 'offer', 'add', 'add-icon'];

export const fields = [
  ...HEAD_FIELDS,
  { k: 'columns', t: 'num', label: 'Columns', placeholder: '3' },
  {
    k: 'items',
    t: 'list',
    label: 'Items',
    fields: [
      { k: 'title', t: 'text', label: 'Title', two: true },
      { k: 'body', t: 'textarea', label: 'Description', two: true },
      { k: 'icon', t: 'select', label: 'Icon', options: 'icons' },
      { k: 'image', t: 'image', label: 'Image (overrides icon)', edge: 640 },
      { k: 'alt', t: 'text', label: 'Image description', two: true },
      { k: 'fit', t: 'select', label: 'Photo fit', options: ['', 'contain'] },
      { k: 'amount', t: 'text', label: 'Price', placeholder: '₹99' },
      { k: 'price', t: 'text', label: 'Note, such as size', two: true },
      {
        k: 'packs', t: 'list', label: 'Pack sizes for ordering', fields: [
          { k: 'label', t: 'text', label: 'Pack', placeholder: '500 g' },
          { k: 'price', t: 'num', label: 'Price ₹' },
          { k: 'offer', t: 'num', label: 'Offer price ₹', hint: 'Optional. Lower than the price; customers see both.' },
        ],
      },
    ],
  },
];
