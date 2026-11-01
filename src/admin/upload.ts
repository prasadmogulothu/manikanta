import { api } from './api';
import { cropBox, type Crop } from './crop';

export type Source = ImageBitmap | HTMLImageElement;

// Keeps visits light on mobile data. The server's hard limit is in lib/uploads.ts.
const TARGET_BYTES = 400_000;
// Sources disagree on WebP and on size limits for link previews, so a share image is a JPEG
// under the strictest limit reported.
const SHARE_TARGET_BYTES = 290_000;
const QUALITIES = [0.82, 0.7, 0.58, 0.46];

// Phone photos carry their rotation as a tag, and a canvas ignores the tag unless
// the image was decoded with it applied.
export async function decode(file: File): Promise<Source> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older Safari knows createImageBitmap but not the options argument.
  }
  const url = URL.createObjectURL(file);
  try {
    // decode(), not onload: a loaded photo may not be decoded yet, and drawing it then can come out blank.
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('That file could not be opened. Please choose a JPEG or PNG photo.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The photo's size after `turns` quarter turns.
export const turnedSize = (src: Source, turns: number) =>
  turns % 2 ? { w: src.height, h: src.width } : { w: src.width, h: src.height };

// Draws the whole photo under a transform and lets the canvas edge do the cropping,
// so rotating needs no second full-size canvas, which a phone may not have memory for.
export function render(canvas: HTMLCanvasElement, src: Source, crop: Crop, turns: number, maxEdge: number) {
  const { w, h } = turnedSize(src, turns);
  const box = cropBox(w, h, crop, maxEdge);
  canvas.width = box.dw;
  canvas.height = box.dh;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // Zoomed out, the frame is bigger than the photo. A logo at full size keeps its transparency.
  if (box.sw > w || box.sh > h) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, box.dw, box.dh);
  }
  ctx.scale(box.dw / box.sw, box.dh / box.sh);
  ctx.translate(w / 2 - box.sx, h / 2 - box.sy);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This phone could not prepare the photo.'))), type, quality),
  );

// Re-encoding also drops the original's tags, GPS position included, so never upload
// the original bytes even when they're small enough.
export async function encode(canvas: HTMLCanvasElement, forSharing = false) {
  // Safari can't write WebP and silently returns a PNG instead.
  const webp = !forSharing && (await toBlob(canvas, 'image/webp', QUALITIES[0])).type === 'image/webp';
  const target = forSharing ? SHARE_TARGET_BYTES : TARGET_BYTES;
  if (!webp) {
    // JPEG has no transparency, so a logo goes onto white rather than black.
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  let blob!: Blob;
  for (const quality of QUALITIES) {
    blob = await toBlob(canvas, webp ? 'image/webp' : 'image/jpeg', quality);
    if (blob.size <= target) break;
  }
  return blob;
}

// Returns the relative path to store in the site's content.
export async function upload(blob: Blob) {
  const { url, key, headers } = await api('POST', '/uploads', { type: blob.type, size: blob.size });
  const put = await fetch(url, { method: 'PUT', body: blob, headers }).catch(() => null);
  if (!put?.ok) throw new Error('The photo could not be sent. Check the connection and try again.');
  await api('POST', '/uploads/confirm', { key });
  return key as string;
}
