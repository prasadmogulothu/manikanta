import { asset } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';
import { Icon } from './icons';

// Also holds products: a category is a section with `catalog: true`, a product an item.
// An item may carry a photo or an icon, so a site without photos still looks finished.
export default function Services({ c }: ModuleProps) {
  const items: any[] = (c.items || []).filter((it: any) => it.enabled !== false);
  return (
    <Section c={c}>
      <div className="cards" style={{ '--cols': +c.columns || 3 } as React.CSSProperties}>
        {items.map((it, i) => (
          <article className="card" key={i}>
            {it.image ? (
              <figure>
                <img
                  src={asset(it.image)}
                  alt={it.alt || ''}
                  loading="lazy"
                  className={it.fit === 'contain' ? 'fit-contain' : undefined}
                />
              </figure>
            ) : it.icon ? (
              <figure>
                <Icon name={it.icon} size={56} />
              </figure>
            ) : null}
            <h3>{it.title}</h3>
            {it.title_2 && <p className="t2">{it.title_2}</p>}
            {it.body && <p>{it.body}</p>}
            {it.price && <span className="price">{it.price}</span>}
          </article>
        ))}
      </div>
    </Section>
  );
}

export const classes = ['cards', 'card', 'price', 't2', 'fit-contain'];

export const fields = [
  ...HEAD_FIELDS,
  { k: 'columns', t: 'num', label: 'Columns', placeholder: '3' },
  {
    k: 'items',
    t: 'list',
    label: 'Items',
    fields: [
      { k: 'title', t: 'text', label: 'Title' },
      { k: 'title_2', t: 'text', label: 'Title, secondary language' },
      { k: 'body', t: 'textarea', label: 'Description' },
      { k: 'icon', t: 'select', label: 'Icon', options: 'icons' },
      { k: 'image', t: 'image', label: 'Image (overrides icon)' },
      { k: 'alt', t: 'text', label: 'Image description' },
      { k: 'fit', t: 'select', label: 'Photo fit', options: ['', 'contain'] },
      { k: 'price', t: 'text', label: 'Price / note' },
      { k: 'enabled', t: 'bool', label: 'Show on site' },
    ],
  },
];
