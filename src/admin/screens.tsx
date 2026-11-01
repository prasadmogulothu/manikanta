import { useEffect, useState } from 'react';
import { asset, safeMapUrl } from '../lib/links';
import { MODULES } from '../modules/registry';
import { api } from './api';
import { FieldForm, MoveButtons, swap, type Field } from './Fields';

export type ScreenProps = { config: Record<string, any>; setConfig: (c: Record<string, any>) => void };

// A category is a services section marked catalog; other sections are Home sections.
export const isCategory = (s: any) => s.type === 'services' && s.config?.catalog === true;

const normalise = (f: any) => (typeof f === 'string' ? { src: f, active: true, popup: false } : f);

export function Flyers({ config, setConfig }: ScreenProps) {
  const sections: any[] = config.sections || [];
  const index = sections.findIndex((s) => s.type === 'gallery');
  if (index < 0) return <div className="stack"><h1>Flyers</h1><p className="muted">This site has no flyer section.</p></div>;

  const images: any[] = (sections[index].config?.images || []).map(normalise);
  const set = (next: any[]) =>
    setConfig({
      ...config,
      sections: sections.map((s, i) => (i === index ? { ...s, config: { ...s.config, images: next } } : s)),
    });
  const patch = (i: number, p: Record<string, any>) => set(images.map((f, j) => (j === i ? { ...f, ...p } : f)));
  // Only one can be chosen, so choosing one clears the rest.
  const choosePopup = (i: number | null) => set(images.map((f, j) => ({ ...f, popup: j === i })));

  function add() {
    const src = window.prompt('Image path');
    if (src?.trim()) set([...images, { src: src.trim(), active: true, popup: false, popup_until: null }]);
  }

  return (
    <div className="stack">
      <div className="screen-head">
        <h1>Flyers</h1>
        <button type="button" className="secondary" onClick={add}>Add flyer</button>
      </div>
      <fieldset className="card">
        <legend>Opens on page load</legend>
        <label className="check">
          <input type="radio" name="popup" checked={!images.some((f) => f.popup)} onChange={() => choosePopup(null)} /> None
        </label>
        <small className="muted">Or choose a flyer below. The chosen flyer leaves the bottom section while it opens as the popup.</small>
      </fieldset>

      {images.map((f, i) => (
        <section className={`card${f.active === false ? ' off' : ''}`} key={`${f.src}-${i}`}>
          <div className="flyer">
            <img src={asset(f.src)} alt="" />
            <div className="stack">
              <div className="row-actions">
                <MoveButtons name={`flyer ${i + 1}`}
                  onUp={i > 0 ? () => set(swap(images, i, i - 1)) : undefined}
                  onDown={i < images.length - 1 ? () => set(swap(images, i, i + 1)) : undefined} />
                <button type="button" className="link danger"
                  onClick={() => { if (window.confirm('Delete this flyer?')) set(images.filter((_, j) => j !== i)); }}>Delete</button>
              </div>
              <label className="check">
                <input type="checkbox" checked={f.active !== false}
                  onChange={(e) => patch(i, e.target.checked ? { active: true } : { active: false, popup: false })} /> Active
              </label>
              <label className={`check${f.active === false ? ' muted' : ''}`}>
                <input type="radio" name="popup" disabled={f.active === false} checked={!!f.popup} onChange={() => choosePopup(i)} /> Open on page load
              </label>
            </div>
          </div>
          <details>
            <summary>Description{f.popup ? ', caption and end date' : ''}</summary>
            <div className="stack">
              <FieldForm value={f} onChange={(next) => set(images.map((x, j) => (j === i ? next : x)))}
                fields={[
                  { k: 'alt', t: 'text', label: 'Description', two: true },
                  ...(f.popup
                    ? [
                        { k: 'caption', t: 'text', label: 'Caption', two: true },
                        { k: 'popup_until', t: 'date', label: 'Stop opening after', hint: 'Optional. Leave empty to keep it opening.' },
                      ]
                    : []),
                ]} />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}

export function HomeSections({ config, setConfig }: ScreenProps) {
  const [open, setOpen] = useState<number | null>(null);
  const sections: any[] = config.sections || [];
  const positions = sections.flatMap((s, i) => (!isCategory(s) && MODULES[s.type] ? [i] : []));
  const setSections = (next: any[]) => setConfig({ ...config, sections: next });
  const setSection = (index: number, patch: Record<string, any>) =>
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <div className="stack">
      <h1>Home sections</h1>
      {positions.map((index, p) => {
        const s = sections[index];
        const hidden = s.enabled === false;
        const isOpen = open === index;
        return (
          <section className={`card${hidden ? ' off' : ''}`} key={index}>
            <div className="row">
              <button type="button" className="row-title" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : index)}>
                <b>{s.config?.heading || MODULES[s.type].label}</b>
                <small>{MODULES[s.type].label}{hidden ? ' · hidden' : ''}</small>
              </button>
              <MoveButtons name="section"
                onUp={p > 0 ? () => { setSections(swap(sections, index, positions[p - 1])); setOpen(null); } : undefined}
                onDown={p < positions.length - 1 ? () => { setSections(swap(sections, index, positions[p + 1])); setOpen(null); } : undefined} />
            </div>
            {isOpen && (
              <div className="stack">
                <label className="check">
                  <input type="checkbox" checked={!hidden} onChange={(e) => setSection(index, { enabled: e.target.checked })} /> Show this section on the site
                </label>
                <FieldForm fields={MODULES[s.type].fields as Field[]} value={s.config || {}}
                  onChange={(next) => setSection(index, { config: next })} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const SITE_FIELDS: Field[] = [
  {
    k: 'brand', t: 'group', label: 'Shop', fields: [
      { k: 'logo', t: 'image', label: 'Logo' },
      { k: 'name', t: 'text', label: 'Shop name', two: true },
      { k: 'wordmark', t: 'text', label: 'Name in header, first part', two: true },
      { k: 'wordmark_accent', t: 'text', label: 'Name in header, coloured part', two: true },
      { k: 'tagline', t: 'text', label: 'Tagline', two: true },
    ],
  },
  {
    k: 'contact', t: 'group', label: 'Contact', fields: [
      { k: 'phone', t: 'text', label: 'Phone, for the call button', placeholder: '+91…' },
      { k: 'phone_display', t: 'text', label: 'Phone, as shown' },
      { k: 'whatsapp', t: 'text', label: 'WhatsApp number', placeholder: '+91…' },
      { k: 'whatsapp_text', t: 'text', label: 'WhatsApp greeting', two: true },
      { k: 'address_lines', t: 'lines', label: 'Address, one line per row' },
      { k: 'address_secondary', t: 'textarea', label: 'Address in the second language' },
      { k: 'map_embed', t: 'text', label: 'Google Maps embed link' },
      {
        k: 'hours', t: 'list', label: 'More numbers or timings', fields: [
          { k: 'label', t: 'text', label: 'Label', two: true },
          { k: 'value', t: 'text', label: 'Value', two: true },
        ],
      },
    ],
  },
  {
    k: 'nav', t: 'list', label: 'Menu links', fields: [
      { k: 'label', t: 'text', label: 'Label', two: true },
      { k: 'href', t: 'text', label: 'Link', placeholder: '#contact' },
    ],
  },
  { k: 'footer', t: 'group', label: 'Footer', fields: [{ k: 'note', t: 'textarea', label: 'Footer note', two: true }] },
  {
    k: 'seo', t: 'group', label: 'Search engines', fields: [
      { k: 'title', t: 'text', label: 'Page title', two: true },
      { k: 'description', t: 'textarea', label: 'Page description', two: true },
    ],
  },
];

export function SiteDetails({ config, setConfig }: ScreenProps) {
  const map = config.contact?.map_embed;
  return (
    <div className="stack">
      <h1>Site details</h1>
      <FieldForm fields={SITE_FIELDS} value={config} onChange={setConfig} />
      {map && !safeMapUrl(map) && <p className="warn">The map link must be a Google Maps link, or the map won't show.</p>}
    </div>
  );
}

export function History({ version, dirty, onRestored }: { version: number; dirty: boolean; onRestored: () => Promise<void> }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api('GET', '/versions').then((d) => setRows(d.versions)).catch((e) => setError(e.message));
  }, [version]);

  async function restore(id: number, when: string) {
    if (!window.confirm(`Bring back the site as it was on ${when}? The site changes straight away.`)) return;
    setError('');
    setDone(false);
    try {
      await api('POST', `/versions/${id}/restore`, { version });
      await onRestored();
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <h1>History</h1>
      <p className="muted">The last 30 saves. Restoring is saved too, so it can be undone.</p>
      {dirty && <p className="warn">Save or discard your changes before restoring.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="ok" role="status">Restored. The site is updated.</p>}
      {rows === null && !error && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <p className="muted">Nothing saved yet.</p>}
      {rows?.map((r, i) => {
        const when = new Date(r.created_at).toLocaleString();
        return (
          <div className="card row" key={r.id}>
            <div className="row-title">
              <b>{when}</b>
              <small>{r.saved_by}{i === 0 ? ' · current' : ''}</small>
            </div>
            {i > 0 && <button type="button" className="secondary" disabled={dirty} onClick={() => restore(r.id, when)}>Restore</button>}
          </div>
        );
      })}
    </div>
  );
}

export function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '' });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await api('POST', '/auth/password', form);
      setForm({ current: '', next: '' });
      setMessage({ ok: true, text: 'Password changed. Other devices have been signed out.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    }
  }

  return (
    <form className="stack narrow" onSubmit={submit}>
      <h1>Change password</h1>
      <div className="field">
        <label htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" autoComplete="current-password" required value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="pw-next">New password</label>
        <input id="pw-next" type="password" autoComplete="new-password" required minLength={10} value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })} />
        <small>At least 10 characters.</small>
      </div>
      {message && <p className={message.ok ? 'ok' : 'error'} role="alert">{message.text}</p>}
      <button type="submit" className="primary">Change password</button>
    </form>
  );
}
