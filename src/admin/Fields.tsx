import { createContext, useContext, useId, type ReactNode } from 'react';
import { asset } from '../lib/links';
import { ICON_NAMES } from '../modules/icons';
import ImagePicker from './ImagePicker';

// Hero and flyers. A field can ask for less with `edge`.
export const DEFAULT_EDGE = 1200;

export type Field = {
  k: string;
  t: string;
  label: string;
  placeholder?: string;
  two?: boolean;
  options?: string[] | 'icons';
  fields?: Field[];
  hint?: string;
  edge?: number;
};
type Obj = Record<string, any>;

const LANGUAGES: Record<string, string> = { te: 'Telugu', en: 'English', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada' };
export const languageName = (code?: string) => (code && LANGUAGES[code]) || code || '';

// The site's two languages, for labelling side-by-side inputs.
export const LangContext = createContext<{ lang?: string; lang2?: string }>({});

export function swap<T>(list: T[], i: number, j: number) {
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function MoveButtons({ onUp, onDown, name }: { onUp?: () => void; onDown?: () => void; name: string }) {
  return (
    <>
      <button type="button" className="icon" onClick={onUp} disabled={!onUp} aria-label={`Move ${name} up`}>↑</button>
      <button type="button" className="icon" onClick={onDown} disabled={!onDown} aria-label={`Move ${name} down`}>↓</button>
    </>
  );
}

function ImageInput({ value, onChange, id, edge }: { value: string; onChange: (v: string) => void; id: string; edge?: number }) {
  return (
    <div className="image-input">
      {value && <img src={asset(value)} alt="" />}
      <ImagePicker id={id} label={value ? 'Change photo' : 'Add photo'} maxEdge={edge || DEFAULT_EDGE} onDone={onChange} />
      {value && <button type="button" className="link danger" onClick={() => onChange('')}>Remove photo</button>}
    </div>
  );
}

function Input({ field, value, onChange, id }: { field: Field; value: any; onChange: (v: any) => void; id: string }) {
  switch (field.t) {
    case 'textarea':
      return <textarea id={id} rows={3} value={value ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'lines':
      return <textarea id={id} rows={4} value={(value || []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} />;
    case 'date':
      return <input id={id} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'num':
      return (
        <input id={id} type="number" inputMode="numeric" value={value ?? ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? undefined : +e.target.value)} />
      );
    case 'select': {
      const options = field.options === 'icons' ? ['', ...ICON_NAMES] : field.options || [];
      return (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      );
    }
    case 'image':
      return <ImageInput id={id} value={value ?? ''} onChange={onChange} edge={field.edge} />;
    default:
      return <input id={id} type="text" value={value ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function Labelled({ label, hint, id, children }: { label: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function TwoLanguages({ field, value, onChange }: { field: Field; value: Obj; onChange: (v: Obj) => void }) {
  const { lang, lang2 } = useContext(LangContext);
  const id = useId();
  const one = <Labelled id={id} label={lang2 ? `${field.label} · ${languageName(lang)}` : field.label} hint={field.hint}>
    <Input id={id} field={field} value={value[field.k]} onChange={(v) => onChange({ ...value, [field.k]: v })} />
  </Labelled>;
  if (!lang2) return one;
  const k2 = `${field.k}_2`;
  return (
    <div className="two">
      {one}
      <Labelled id={`${id}2`} label={`${field.label} · ${languageName(lang2)}`}>
        <Input id={`${id}2`} field={field} value={value[k2]} onChange={(v) => onChange({ ...value, [k2]: v })} />
      </Labelled>
    </div>
  );
}

function ListField({ field, value, onChange }: { field: Field; value: Obj[]; onChange: (v: Obj[]) => void }) {
  return (
    <fieldset className="list">
      <legend>{field.label}</legend>
      {value.map((row, i) => (
        <div className="list-row" key={i}>
          <FieldForm fields={field.fields || []} value={row} onChange={(r) => onChange(value.map((x, j) => (j === i ? r : x)))} />
          <div className="row-actions">
            <MoveButtons name={`item ${i + 1}`}
              onUp={i > 0 ? () => onChange(swap(value, i, i - 1)) : undefined}
              onDown={i < value.length - 1 ? () => onChange(swap(value, i, i + 1)) : undefined} />
            <button type="button" className="link danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...value, {}])}>Add</button>
    </fieldset>
  );
}

function OneField({ field, value, onChange }: { field: Field; value: Obj; onChange: (v: Obj) => void }) {
  const id = useId();
  const set = (v: any) => onChange({ ...value, [field.k]: v });
  if (field.t === 'list') return <ListField field={field} value={value[field.k] || []} onChange={set} />;
  if (field.t === 'group') {
    return (
      <fieldset className="list">
        <legend>{field.label}</legend>
        <FieldForm fields={field.fields || []} value={value[field.k] || {}} onChange={set} />
      </fieldset>
    );
  }
  if (field.t === 'bool') {
    return (
      <label className="check">
        <input type="checkbox" checked={!!value[field.k]} onChange={(e) => set(e.target.checked)} /> {field.label}
      </label>
    );
  }
  if (field.two) return <TwoLanguages field={field} value={value} onChange={onChange} />;
  return (
    <Labelled id={id} label={field.label} hint={field.hint}>
      <Input id={id} field={field} value={value[field.k]} onChange={set} />
    </Labelled>
  );
}

// Forms come from each module's `fields`, so a new field needs no form code.
export function FieldForm({ fields, value, onChange }: { fields: Field[]; value: Obj; onChange: (v: Obj) => void }) {
  return <>{fields.map((f) => <OneField key={f.k} field={f} value={value} onChange={onChange} />)}</>;
}
