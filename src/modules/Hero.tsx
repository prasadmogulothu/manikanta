import { asset, ctaHref } from '../lib/links';
import type { ModuleProps } from '../lib/types';

// Not wrapped in <Section>: it runs full bleed with its own background image.
export default function Hero({ c, site }: ModuleProps) {
  const ctas: any[] = c.ctas || [];
  return (
    <section className="hero" id="top" style={c.height ? ({ '--hero-h': c.height } as React.CSSProperties) : undefined}>
      {c.image && (
        <div className="hero-bg">
          <img src={asset(c.image)} alt={c.image_alt || ''} />
        </div>
      )}
      <div className="wrap">
        <div className="hero-in">
          <h1>{c.heading || site.name}</h1>
          {c.heading_2 && <p className="t2">{c.heading_2}</p>}
          {c.sub && <p className="hero-sub">{c.sub}</p>}
          {ctas.length > 0 && (
            <div className="ctas">
              {ctas.map((b, i) => (
                <a key={i} className={i ? 'btn ghost' : 'btn'} href={ctaHref(b, site.config.contact)}>
                  {b.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const fields = [
  { k: 'image', t: 'image', label: 'Banner image' },
  { k: 'image_alt', t: 'text', label: 'Image description' },
  { k: 'heading', t: 'text', label: 'Heading' },
  { k: 'heading_2', t: 'text', label: 'Heading, secondary language' },
  { k: 'sub', t: 'textarea', label: 'Sub-heading' },
  { k: 'height', t: 'text', label: 'Height', placeholder: '68vh' },
  {
    k: 'ctas',
    t: 'list',
    label: 'Buttons',
    fields: [
      { k: 'label', t: 'text', label: 'Label' },
      { k: 'action', t: 'select', label: 'Action', options: ['', 'call', 'whatsapp'] },
      { k: 'href', t: 'text', label: 'Link, if no action', placeholder: '#contact' },
    ],
  },
];

export const classes = ['hero', 'hero-bg', 'hero-in', 'hero-sub', 'ctas', 'btn', 'wrap', 't2'];
