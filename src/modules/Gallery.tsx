import { asset } from '../lib/links';
import type { ModuleProps } from '../lib/types';
import { Section, HEAD_FIELDS } from './Section';

// The page is cached, so the end date has to be checked in the visitor's browser.
const OPEN_POPUP = `addEventListener('load', function () {
  var d = document.getElementById('flyer-popup');
  var until = d.getAttribute('data-until');
  if (until && new Date().toISOString().slice(0, 10) > until) return;
  d.onclick = function (e) { if (e.target === d) d.close(); };
  d.showModal();
});`;

// A flyer is a path, or an object carrying its description and state. The one chosen
// as the popup opens on page load instead of showing below, and an inactive one
// shows nowhere.
export default function Gallery({ c }: ModuleProps) {
  const all: any[] = (c.images || [])
    .map((f: any) => (typeof f === 'string' ? { src: f } : f))
    .filter((f: any) => f.active !== false);
  const flyers = all.filter((f) => !f.popup);
  const popup = all.find((f) => f.popup);
  return (
    <>
      {flyers.length > 0 && (
        <Section c={c}>
          <div className="gallery">
            {flyers.map((f, i) => (
              <img key={i} src={asset(f.src)} alt={f.alt || ''} loading="lazy" />
            ))}
          </div>
        </Section>
      )}
      {popup && (
        <>
          <dialog className="wishes" id="flyer-popup" data-until={popup.popup_until || undefined} aria-label={popup.caption || popup.alt || undefined}>
            <form method="dialog">
              <button className="x" aria-label="Close">&times;</button>
            </form>
            <img src={asset(popup.src)} alt={popup.alt || ''} />
            {popup.caption && <p>{popup.caption}</p>}
          </dialog>
          <script dangerouslySetInnerHTML={{ __html: OPEN_POPUP }} />
        </>
      )}
    </>
  );
}

export const classes = ['gallery', 'wishes', 'x'];

export const fields = [...HEAD_FIELDS];
