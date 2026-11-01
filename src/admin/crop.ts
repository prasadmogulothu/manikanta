// Crop geometry. Pure, so scripts/modules.check.mjs can test it without a browser.

// null keeps the photo's own shape.
export const ASPECTS = [
  { label: 'Original', value: null },
  { label: 'Square', value: 1 },
  { label: 'Wide 16:9', value: 16 / 9 },
  { label: 'Portrait 4:5', value: 4 / 5 },
];

// zoom: 1 is the largest crop that fits, and below 1 the frame is bigger than the photo,
// so the whole product can fit a shape, with white around it.
// x, y: 0 is left/top, 1 is right/bottom.
export type Crop = { aspect: number | null; zoom: number; x: number; y: number };

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(z) || 1));

const unit = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

// The new x or y after dragging the photo by `moved`, a fraction of the preview's size.
// The photo follows the finger whether the frame is smaller or bigger than the photo,
// because room changes sign between the two.
export function dragged(start: number, moved: number, frame: number, photo: number) {
  const room = photo - frame;
  return room ? unit(start - (moved * frame) / room) : start;
}

// Where to take the crop from, and how big to draw it. Never upscales.
export function cropBox(w: number, h: number, crop: Crop, maxEdge: number) {
  if (!(w > 0) || !(h > 0)) throw new Error('bad image size');
  const { aspect } = crop;
  let sw = w;
  let sh = h;
  if (aspect && aspect > 0) {
    if (w / h > aspect) sw = h * aspect;
    else sh = w / aspect;
  }
  const zoom = clampZoom(crop.zoom);
  sw /= zoom;
  sh /= zoom;
  const sx = Math.round((w - sw) * unit(crop.x));
  const sy = Math.round((h - sh) * unit(crop.y));
  sw = Math.max(1, Math.round(sw));
  sh = Math.max(1, Math.round(sh));
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
}
