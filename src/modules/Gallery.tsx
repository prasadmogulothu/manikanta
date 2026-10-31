import { asset } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';

// A flyer is a path, or an object carrying its description and state. The flyer
// chosen as the popup shows there instead (Phase 4), and an inactive one nowhere.
export default function Gallery({ c }: ModuleProps) {
  const flyers: any[] = (c.images || [])
    .map((f: any) => (typeof f === 'string' ? { src: f } : f))
    .filter((f: any) => f.active !== false && !f.popup);
  if (!flyers.length) return null;
  return (
    <Section c={c}>
      <div className="gallery">
        {flyers.map((f, i) => (
          <img key={i} src={asset(f.src)} alt={f.alt || ''} loading="lazy" />
        ))}
      </div>
    </Section>
  );
}

export const classes = ['gallery'];

export const fields = [...HEAD_FIELDS];
