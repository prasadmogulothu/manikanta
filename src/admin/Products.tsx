import { useContext, useState } from 'react';
import { asset } from '../lib/links';
import { packsOf } from '../lib/orders';
import { MODULES } from '../modules/registry';
import { FieldForm, LangContext, MoveButtons, swap, type Field } from './Fields';
import { isCategory, menuHref, orderMenu, setInMenu } from './menu';
import type { ScreenProps } from './screens';

const fieldsOf = (type: string) => MODULES[type].fields as Field[];
const itemFields = fieldsOf('services').find((f) => f.k === 'items')!.fields!;

// Pack sizes suggested for how a product is sold; the owner can still type any other.
const PACKS: Record<string, string[]> = {
  weight: ['50 g', '100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg', '25 kg', '50 kg', '100 kg'],
  liquid: ['50 ml', '100 ml', '150 ml', '250 ml', '½ litre', '1 litre', '2 litre', '5 litre', '10 litre'],
  count: ['1 item', '2 pack', '6 pack', '10 pack', '12 pack', '20 pack', '30 pack', '50 pack'],
};
// Pack sizes show once the owner has said how the product is sold (or it already has some).
const fieldsFor = (it: any) => itemFields.flatMap((f) => {
  if (f.k !== 'packs') return [f];
  if (!it.unit && !it.packs?.length) return [];
  return [{ ...f, fields: f.fields!.map((p) => (p.k === 'label' ? { ...p, options: PACKS[it.unit], placeholder: PACKS[it.unit]?.[3] ?? p.placeholder } : p)) }];
});

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
  const nav: any[] = config.nav || [];
  // Pack prices only matter on a site the platform lets take orders.
  const takesOrders = config.features?.orders === true;
  const productFields = (it: any) => (takesOrders ? fieldsFor(it) : itemFields.filter((f) => f.k !== 'packs' && f.k !== 'unit'));
  const orders = config.orders || {};

  // The menu follows the categories' order, so moving one moves its link too.
  const setSections = (next: any[]) => setConfig({ ...config, sections: next, nav: orderMenu(nav, next) });
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
    if (!window.confirm(warning)) return;
    setConfig({ ...config, sections: sections.filter((_, i) => i !== index), nav: setInMenu(nav, sections, sections[index], false) });
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
      {takesOrders && (
        <div className="card stack">
          <label className="check">
            <input type="checkbox" checked={orders.enabled === true}
              onChange={(e) => setConfig({ ...config, orders: { ...orders, enabled: e.target.checked } })} /> Take orders on WhatsApp
          </label>
          <small className="muted">Only products with a pack size and price get an Add to cart button.</small>
          <FieldForm fields={[{ k: 'note', t: 'text', label: 'Delivery note shown in the cart', placeholder: 'Delivery available to … area only' }]}
            value={orders} onChange={(next) => setConfig({ ...config, orders: next })} />
        </div>
      )}
      {positions.length === 0 && <p className="muted">No categories yet.</p>}

      {positions.map((index, p) => {
        const s = sections[index];
        const c = s.config;
        const items: any[] = c.items || [];
        const isOpen = open === c.id;
        const hidden = s.enabled === false;
        const link = nav.find((n) => n.href === menuHref(s));
        return (
          <section className={`card${hidden ? ' off' : ''}`} key={c.id}>
            <div className="row">
              <button type="button" className="row-title" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : c.id); setEditing(null); }}>
                <b>Category #{p + 1} · {c.heading || c.heading_2 || 'Untitled category'}</b>
                <small>{items.length} products{hidden ? ' · hidden' : link ? ' · in top menu' : ''}</small>
                {!isOpen && <small>Click to open details</small>}
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
                <label className="check">
                  <input type="checkbox" checked={!!link} onChange={(e) => setConfig({ ...config, nav: setInMenu(nav, sections, s, e.target.checked) })} /> Show in the top menu
                </label>
                {link && (
                  <div className="field">
                    <FieldForm fields={[{ k: 'label', t: 'text', label: 'Name in the top menu', two: true }]} value={link}
                      onChange={(next) => setConfig({ ...config, nav: nav.map((n) => (n === link ? next : n)) })} />
                    <small>One or two words, so the menu stays short.</small>
                  </div>
                )}
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
                          <small>{[it.title && it.title_2, it.amount, takesOrders && (packsOf(it).length ? 'can be ordered' : it.packs?.length && 'out of stock'), off && 'hidden'].filter(Boolean).join(' · ')}</small>
                          {missing && <small className="warn">Title needs both languages</small>}
                          {editing !== i && <small>Click to open details</small>}
                        </button>
                        <MoveButtons name={it.title || 'product'}
                          onUp={i > 0 ? () => setItems(index, swap(items, i, i - 1)) : undefined}
                          onDown={i < items.length - 1 ? () => setItems(index, swap(items, i, i + 1)) : undefined} />
                      </div>
                      {editing === i && (
                        <div className="stack">
                          <FieldForm fields={productFields(it)} value={it}
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
