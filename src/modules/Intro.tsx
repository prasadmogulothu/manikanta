import { asset } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, T2, HEAD_FIELDS } from './Section';

// With no portrait there is no second column, or the body sits off-centre.
export default function Intro({ c }: ModuleProps) {
  const stats: any[] = c.stats || [];
  return (
    <Section c={c}>
      <div className={c.portrait ? 'intro' : 'intro solo'}>
        {c.portrait && (
          <div className="intro-portrait">
            <img src={asset(c.portrait)} alt={c.portrait_alt || ''} loading="lazy" />
          </div>
        )}
        <div className="intro-body">
          {c.seal?.value && (
            <div className="seal">
              <span>{c.seal.label || ''}</span>
              <b>{c.seal.value}</b>
            </div>
          )}
          {c.body && <p>{c.body}</p>}
          <T2>{c.body_2}</T2>
          {stats.length > 0 && (
            <div className="stats">
              {stats.map((s, i) => (
                <div key={i}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export const classes = ['intro', 'solo', 'intro-portrait', 'intro-body', 'seal', 'stats'];

export const fields = [
  ...HEAD_FIELDS,
  { k: 'portrait', t: 'image', label: 'Portrait / photo' },
  { k: 'portrait_alt', t: 'text', label: 'Photo description' },
  { k: 'body', t: 'textarea', label: 'Body' },
  { k: 'body_2', t: 'textarea', label: 'Body, secondary language' },
  {
    k: 'seal',
    t: 'group',
    label: 'Seal badge',
    fields: [
      { k: 'label', t: 'text', label: 'Label', placeholder: 'Est' },
      { k: 'value', t: 'text', label: 'Value', placeholder: '1998' },
    ],
  },
  {
    k: 'stats',
    t: 'list',
    label: 'Stats',
    fields: [
      { k: 'value', t: 'text', label: 'Value', placeholder: '28' },
      { k: 'label', t: 'text', label: 'Label', placeholder: 'Years' },
    ],
  },
];
