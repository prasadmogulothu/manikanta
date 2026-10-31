import { Fragment } from 'react';
import { safeMapUrl } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';
import { Icon } from './icons';

// Address and phone live in site.config.contact: the header's call button reads the
// same values, and three copies of a number is three chances to change two of them.
export default function Contact({ c, site }: ModuleProps) {
  const k = site.config.contact || {};
  const hours: any[] = k.hours || [];
  const lines: string[] = k.address_lines || [];
  const map = c.show_map && safeMapUrl(k.map_embed);

  return (
    <Section c={c}>
      <div className="info">
        <div className="panel">
          <div className="pl">
            <Icon name="pin" size={20} /> {c.address_label || 'Address'}
          </div>
          <p className="addr">
            <b>{site.name}</b>
            {lines.map((l, i) => (
              <Fragment key={i}>
                <br />
                {l}
              </Fragment>
            ))}
          </p>
          {k.address_secondary && <p className="addr addr-2 t2">{k.address_secondary}</p>}
          {map && (
            <div className="map">
              <iframe src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Map" />
            </div>
          )}
        </div>

        <div className="panel">
          <div className="pl">
            <Icon name="phone" size={20} /> {c.phone_label || 'Contact number'}
          </div>
          <a className="tel" href={`tel:${k.phone}`}>
            {k.phone_display || k.phone}
          </a>
          {hours.length > 0 && (
            <>
              <div className="divide" />
              <div className="pl">
                <Icon name={c.hours_icon || 'clock'} size={20} /> {c.hours_label || 'Timings'}
              </div>
              <div className="hours">
                {hours.map((h, i) => (
                  <div className="row" key={i}>
                    <span>{h.label}</span>
                    <b>{h.value}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

export const classes = ['info', 'panel', 'pl', 'addr', 'addr-2', 'map', 'tel', 'divide', 'hours', 'row', 't2'];

export const fields = [
  ...HEAD_FIELDS,
  { k: 'address_label', t: 'text', label: 'Address label' },
  { k: 'phone_label', t: 'text', label: 'Phone label' },
  { k: 'hours_label', t: 'text', label: 'Second panel label' },
  { k: 'hours_icon', t: 'select', label: 'Second panel icon', options: ['clock', 'message'] },
  { k: 'show_map', t: 'bool', label: 'Show map' },
];
