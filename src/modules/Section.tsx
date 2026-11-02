import type { ReactNode } from 'react';
import type { Cfg } from '../lib/types';

// The wrapper every section shares, so a template restyles all headings with one rule.

export function SectionHead({ c }: { c: Cfg }) {
  if (!c.kicker && !c.heading && !c.heading_2 && !c.sub) return null;
  return (
    <div className="sec-head">
      {c.kicker && <div className="sec-kicker">{c.kicker}</div>}
      {c.heading && <h2 className="sec-title">{c.heading}</h2>}
      {c.heading_2 && <p className="sec-sub t2">{c.heading_2}</p>}
      {c.sub && <p className="sec-sub">{c.sub}</p>}
      {c.ornament && (
        <div className="orn">
          <span />
          <i />
          <span />
        </div>
      )}
    </div>
  );
}

export function Section({ c = {}, children }: { c?: Cfg; children: ReactNode }) {
  return (
    <section className={`sec${c.alt ? ' alt' : ''}`} id={c.id || undefined}>
      <div className="wrap">
        <SectionHead c={c} />
        {children}
      </div>
    </section>
  );
}

// The admin form for the shared head, beside the markup it fills.
export const HEAD_FIELDS = [
  { k: 'kicker', t: 'text', label: 'Kicker' },
  { k: 'heading', t: 'text', label: 'Heading', two: true },
  { k: 'sub', t: 'textarea', label: 'Sub-heading', two: true },
];
