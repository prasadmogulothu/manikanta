import { asset } from '../lib/links';
import { inr, ordersOn, packsOf } from '../lib/orders';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';
import { Icon } from './icons';

// Also holds products: a category is a section with `catalog: true`, a product an item.
// An item may carry a photo or an icon, so a site without photos still looks finished.
// On the home page a category shows its first HOME_LIMIT products and links to its own page.
export const HOME_LIMIT = 10;

export default function Services({ c, site }: ModuleProps) {
  const all: any[] = (c.items || []).filter((it: any) => it.enabled !== false);
  const preview = c.home && c.catalog && c.id;
  const items = preview ? all.slice(0, HOME_LIMIT) : all;
  const viewAll = preview && (
    <div className="view-all"><a href={`/category/${encodeURIComponent(c.id)}`}>View all{all.length > HOME_LIMIT ? ` (${all.length})` : ''} →</a></div>
  );
  const showPrices = site.config.show_prices !== false;
  const canOrder = ordersOn(site.config);
  const addLabel = 'Add to cart';
  return (
    <Section c={c}>
      {viewAll}
      <div className="cards" style={{ '--cols': +c.columns || 3 } as React.CSSProperties}>
        {items.map((it, i) => {
          const packs = packsOf(it);
          // The card price shows below the title, and only when no pack prices already say it.
          const amount = showPrices && packs.length === 0 && it.amount?.trim();
          // Chrome's Cart listens for clicks on data-add, so this stays a server component.
          const data = canOrder && packs.length > 0 ? JSON.stringify({ cat: c.id, title: it.title, title_2: it.title_2, packs }) : null;
          const hasFigure = !!(it.image || it.icon);
          // On a photo: a cart icon at its bottom-right corner. Without one: a text button.
          const cartIcon = data && hasFigure && (
            <button type="button" className="add-icon" data-add={data} aria-label={`${addLabel}: ${it.title || ''}`}>
              <Icon name="cart" size={18} />
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
                {cartIcon}
              </figure>
            ) : it.icon ? (
              <figure>
                <Icon name={it.icon} size={56} />
                {cartIcon}
              </figure>
            ) : null}
            <h3>{it.title}</h3>
            {it.title_2 && <p className="t2">{it.title_2}</p>}
            {amount && <p className="amount">{amount}</p>}
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
      {viewAll}
    </Section>
  );
}

export const classes = ['cards', 'card', 'price', 't2', 'fit-contain', 'amount', 'packs', 'offer', 'add', 'add-icon', 'view-all'];

export const fields = [
  ...HEAD_FIELDS,
  { k: 'columns', t: 'num', label: 'Columns', placeholder: '3' },
  {
    k: 'items',
    t: 'list',
    label: 'Items',
    fields: [
      { k: 'title', t: 'text', label: 'Title', two: true },
      { k: 'unit', t: 'select', label: 'Sold by', options: ['', 'weight', 'liquid', 'count'],
        hint: 'weight: g / kg · liquid: ml / litre · count: items or packs. Pick it before adding pack sizes.' },
      {
        k: 'packs', t: 'list', label: 'Pack sizes for ordering', fields: [
          { k: 'label', t: 'text', label: 'Pack', placeholder: '500 g', hint: 'Pick one or type your own.' },
          { k: 'price', t: 'num', label: 'Price ₹' },
          { k: 'offer', t: 'num', label: 'Offer price ₹', hint: 'Optional. Lower than the price; customers see both.' },
          { k: 'out', t: 'bool', label: 'Out of stock (hidden from the site until unticked)' },
        ],
      },
      { k: 'body', t: 'textarea', label: 'Description', two: true },
      { k: 'icon', t: 'select', label: 'Icon', options: 'icons' },
      { k: 'image', t: 'image', label: 'Image (overrides icon)', edge: 640 },
      { k: 'alt', t: 'text', label: 'Image description', two: true },
      { k: 'fit', t: 'select', label: 'Photo fit', options: ['', 'contain'],
        hint: '— fills the photo frame and may trim the edges · contain shows the whole photo, with space around it' },
      { k: 'amount', t: 'text', label: 'Price shown on the card (not used for orders)', placeholder: '₹99' },
      { k: 'price', t: 'text', label: 'Note, such as size', two: true },
    ],
  },
];
