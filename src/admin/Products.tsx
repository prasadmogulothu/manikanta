import { useContext, useState } from 'react';
import { asset } from '../lib/links';
import { MODULES } from '../modules/registry';
import { FieldForm, LangContext, MoveButtons, swap, type Field } from './Fields';
import { isCategory, type ScreenProps } from './screens';

const fieldsOf = (type: string) => MODULES[type].fields as Field[];

function slugify(text: string, taken: string[]) {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export default function Products({ config, setConfig }: ScreenProps) {
  const { lang2 } = useContext(LangContext);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const sections: any[] = config.sections || [];
  const positions = sections.flatMap((s, i) => (isCategory(s) ? [i] : []));

  const setSections = (next: any[]) => setConfig({ ...config, sections: next });
  const setCategory = (index: number, patch: Record<string, any>) =>
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const setItems = (index: number, items: any[]) =>
    setCategory(index, { config: { ...sections[index].config, items } });

  function addCategory() {
    const title = window.prompt('English name of the new category');
    if (!title?.trim()) return;
    const id = slugify(title, sections.map((s) => s.config?.id).filter(Boolean));
    const category = {
      type: 'services',
      enabled: true,
      config: { id, catalog: true, ornament: true, columns: 3, heading: '', heading_2: title.trim(), items: [] },
    };
    const after = positions.length ? positions[positions.length - 1] + 1 : sections.length;
    setSections([...sections.slice(0, after), category, ...sections.slice(after)]);
    setOpen(id);
    setEditing(null);
  }

  function deleteCategory(index: number) {
    const { heading, heading_2, items = [] } = sections[index].config;
    const name = heading || heading_2 || 'this category';
    const warning = items.length
      ? `Delete ${name} and its ${items.length} products? You can bring them back from History after saving.`
      : `Delete ${name}?`;
    if (window.confirm(warning)) setSections(sections.filter((_, i) => i !== index));
  }

  return (
    <div className="stack">
      <div className="screen-head">
        <h1>Products</h1>
        <button type="button" className="secondary" onClick={addCategory}>Add category</button>
      </div>
      <label className="check card">
        <input type="checkbox" checked={config.show_prices !== false}
          onChange={(e) => setConfig({ ...config, show_prices: e.target.checked })} /> Show prices on the site
      </label>
      {positions.length === 0 && <p className="muted">No categories yet.</p>}

      {positions.map((index, p) => {
        const s = sections[index];
        const c = s.config;
        const items: any[] = c.items || [];
        const isOpen = open === c.id;
        const hidden = s.enabled === false;
        return (
          <section className={`card${hidden ? ' off' : ''}`} key={c.id}>
            <div className="row">
              <button type="button" className="row-title" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : c.id); setEditing(null); }}>
                <b>{c.heading || c.heading_2 || 'Untitled category'}</b>
                <small>{items.length} products{hidden ? ' · hidden' : ''}</small>
              </button>
              <MoveButtons name="category"
                onUp={p > 0 ? () => setSections(swap(sections, index, positions[p - 1])) : undefined}
                onDown={p < positions.length - 1 ? () => setSections(swap(sections, index, positions[p + 1])) : undefined} />
            </div>

            {isOpen && (
              <div className="stack">
                <label className="check">
                  <input type="checkbox" checked={!hidden} onChange={(e) => setCategory(index, { enabled: e.target.checked })} /> Show this category on the site
                </label>
                <details>
                  <summary>Category title, intro and columns</summary>
                  <div className="stack">
                    <FieldForm fields={fieldsOf('services').filter((f) => f.k !== 'items')} value={c}
                      onChange={(next) => setCategory(index, { config: next })} />
                  </div>
                </details>

                <h2>Products</h2>
                {items.map((it, i) => {
                  const missing = lang2 && (!it.title?.trim() || !it.title_2?.trim());
                  const off = it.enabled === false;
                  return (
                    <div className={`product${off ? ' off' : ''}`} key={i}>
                      <div className="row">
                        {it.image ? <img src={asset(it.image)} alt="" /> : <span className="no-image" />}
                        <button type="button" className="row-title" aria-expanded={editing === i} onClick={() => setEditing(editing === i ? null : i)}>
                          <b>{it.title || it.title_2 || 'New product'}</b>
                          <small>{[it.title && it.title_2, it.amount, off && 'hidden'].filter(Boolean).join(' · ')}</small>
                          {missing && <small className="warn">Title needs both languages</small>}
                        </button>
                        <MoveButtons name={it.title || 'product'}
                          onUp={i > 0 ? () => setItems(index, swap(items, i, i - 1)) : undefined}
                          onDown={i < items.length - 1 ? () => setItems(index, swap(items, i, i + 1)) : undefined} />
                      </div>
                      {editing === i && (
                        <div className="stack">
                          <FieldForm fields={fieldsOf('services').find((f) => f.k === 'items')!.fields!} value={it}
                            onChange={(next) => setItems(index, items.map((x, j) => (j === i ? next : x)))} />
                          <label className="check">
                            <input type="checkbox" checked={!off} onChange={(e) => setItems(index, items.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /> Show on the site
                          </label>
                          <button type="button" className="link danger"
                            onClick={() => { if (window.confirm(`Delete ${it.title || 'this product'}?`)) { setItems(index, items.filter((_, j) => j !== i)); setEditing(null); } }}>
                            Delete product
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="secondary" onClick={() => { setItems(index, [...items, {}]); setEditing(items.length); }}>Add product</button>
                <button type="button" className="link danger" onClick={() => deleteCategory(index)}>Delete category</button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
