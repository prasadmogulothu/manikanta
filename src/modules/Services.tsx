import { asset } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';
import { Icon } from './icons';

// Also holds products: a category is a section with `catalog: true`, a product an item.
// An item may carry a photo or an icon, so a site without photos still looks finished.
export default function Services({ c, site }: ModuleProps) {
  const items: any[] = (c.items || []).filter((it: any) => it.enabled !== false);
  const showPrices = site.config.show_prices !== false;
  return (
    <Section c={c}>
      <div className="cards" style={{ '--cols': +c.columns || 3 } as React.CSSProperties}>
        {items.map((it, i) => {
          // No price, or prices switched off: no tag at all, not an empty one.
          const amount = showPrices && it.amount?.trim();
          const tag = amount ? <span className="amount">{amount}</span> : null;
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
              </figure>
            ) : it.icon ? (
              <figure>
                <Icon name={it.icon} size={56} />
                {tag}
              </figure>
            ) : (
              tag
            )}
            <h3>{it.title}</h3>
            {it.title_2 && <p className="t2">{it.title_2}</p>}
            {it.body && <p>{it.body}</p>}
            {it.price && <span className="price">{it.price}</span>}
          </article>
          );
        })}
      </div>
    </Section>
  );
}

export const classes = ['cards', 'card', 'price', 't2', 'fit-contain', 'amount'];

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
    ],
  },
];
