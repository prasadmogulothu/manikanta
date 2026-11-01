import { useEffect, useRef, useState } from 'react';
import { ASPECTS, ZOOM_MAX, ZOOM_MIN, clampZoom, cropBox, dragged, type Crop } from './crop';
import { decode, encode, render, turnedSize, upload, type Source } from './upload';

const NO_CROP: Crop = { aspect: null, zoom: 1, x: 0.5, y: 0.5 };
const ZOOM_STEP = 0.1;

// Choose a photo, crop it, send it. Dragging is the quick way to position it, and the
// sliders stay because they also work with a keyboard and a screen reader.
// ponytail: no pinch to zoom, the zoom bar covers it. Add it if owners keep trying to pinch.
export default function ImagePicker({ id, label, maxEdge, onDone }: {
  id?: string;
  label: string;
  maxEdge: number;
  onDone: (path: string) => void;
}) {
  const [src, setSrc] = useState<Source | null>(null);
  const [crop, setCrop] = useState(NO_CROP);
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number } | null>(null);

  const [redraw, setRedraw] = useState(0);

  useEffect(() => {
    if (src && canvas.current) render(canvas.current, src, crop, turns, maxEdge);
  }, [src, crop, turns, maxEdge, redraw]);

  // Some phones don't show a canvas's very first draw, though any later one appears. Draw again
  // once a frame has been painted. A hidden page runs no frames, so this also waits for the
  // return from the phone's gallery.
  // ponytail: not reproduced on desktop Chrome; the symptom came from a real phone.
  useEffect(() => {
    if (!src) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRedraw((n) => n + 1));
    });
    return () => cancelAnimationFrame(frame);
  }, [src]);

  // A decoded phone photo holds tens of MB until it's closed.
  useEffect(() => () => { if (src && 'close' in src) src.close(); }, [src]);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same photo again still fires
    if (!file) return;
    setBusy('Opening…');
    setError('');
    try {
      setSrc(await decode(file));
      setCrop(NO_CROP);
      setTurns(0);
    } catch (err: any) {
      setError(err.message);
    }
    setBusy('');
  }

  async function send() {
    setBusy('Uploading…');
    setError('');
    try {
      onDone(await upload(await encode(canvas.current!)));
      setSrc(null);
    } catch (err: any) {
      setError(err.message);
    }
    setBusy('');
  }

  const set = (patch: Partial<Crop>) => setCrop({ ...crop, ...patch });
  const size = src && turnedSize(src, turns);
  const box = size && cropBox(size.w, size.h, crop, maxEdge);
  const zoomBy = (step: number) => set({ zoom: clampZoom(+(crop.zoom + step).toFixed(2)) });

  function startDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drag.current) return; // a second finger doesn't take over
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  }

  function moveDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !box || !size) return;
    const shown = e.currentTarget.getBoundingClientRect();
    set({
      x: dragged(d.x, (e.clientX - d.px) / shown.width, box.sw, size.w),
      y: dragged(d.y, (e.clientY - d.py) / shown.height, box.sh, size.h),
    });
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  return (
    <div className="picker">
      {!src && (
        <label className="secondary file">
          {busy || label}
          <input id={id} type="file" accept="image/*" disabled={!!busy} onChange={choose} />
        </label>
      )}
      {src && size && box && (
        <>
          {/* Fills the width even when a small photo gives a small canvas, so zooming doesn't resize it. */}
          <canvas ref={canvas} role="img" aria-label="How the photo will look"
            style={{ width: `min(100%, ${(50 * box.dw) / box.dh}vh)`, aspectRatio: `${box.dw} / ${box.dh}` }}
            onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />
          <small className="muted">Drag the photo to move it. Only what you see here is saved.</small>
          <div className="field">
            <label htmlFor={`${id}-shape`}>Shape</label>
            <select id={`${id}-shape`} value={ASPECTS.findIndex((a) => a.value === crop.aspect)}
              onChange={(e) => set({ aspect: ASPECTS[+e.target.value].value })}>
              {ASPECTS.map((a, i) => <option key={a.label} value={i}>{a.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-zoom`}>Zoom</label>
            <div className="zoom">
              <button type="button" className="icon" aria-label="Zoom out" disabled={crop.zoom <= ZOOM_MIN} onClick={() => zoomBy(-ZOOM_STEP)}>−</button>
              <input id={`${id}-zoom`} type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.05" value={crop.zoom} onChange={(e) => set({ zoom: +e.target.value })} />
              <button type="button" className="icon" aria-label="Zoom in" disabled={crop.zoom >= ZOOM_MAX} onClick={() => zoomBy(ZOOM_STEP)}>+</button>
            </div>
          </div>
          {box.sw !== size.w && (
            <label className="field">
              Left and right
              <input type="range" min="0" max="1" step="0.01" value={crop.x} onChange={(e) => set({ x: +e.target.value })} />
            </label>
          )}
          {box.sh !== size.h && (
            <label className="field">
              Up and down
              <input type="range" min="0" max="1" step="0.01" value={crop.y} onChange={(e) => set({ y: +e.target.value })} />
            </label>
          )}
          <div className="row-actions">
            <button type="button" className="primary" disabled={!!busy} onClick={send}>{busy || 'Use this photo'}</button>
            <button type="button" className="secondary" disabled={!!busy} onClick={() => setTurns((turns + 1) % 4)}>Rotate</button>
            <button type="button" className="link" disabled={!!busy} onClick={() => setSrc(null)}>Cancel</button>
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
