// What an owner may save. Pure, with no imports, so it can be tested on its own.

export const MAX_CONTENT_BYTES = 1_000_000;

// The owner edits content. Theme, tracking, features (such as orders) and the credit stay
// with the platform.
const PLATFORM_KEYS = ['theme', 'tracking', 'features'];
const PLATFORM_FOOTER_KEYS = ['powered_by', 'powered_by_label', 'powered_by_url', 'powered_by_logo'];

export class ContentError extends Error {}

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function prepareContent(current: Record<string, any>, incoming: unknown) {
  if (!isObject(incoming)) throw new ContentError('Content must be an object');
  if (Buffer.byteLength(JSON.stringify(incoming)) > MAX_CONTENT_BYTES) throw new ContentError('Content is too large');
  if (incoming.sections !== undefined && !Array.isArray(incoming.sections)) throw new ContentError('Sections must be a list');

  const popups = (incoming.sections || [])
    .flatMap((s: any) => (s?.type === 'gallery' && Array.isArray(s.config?.images) ? s.config.images : []))
    .filter((f: any) => f?.popup === true);
  if (popups.length > 1) throw new ContentError('Only one flyer can open on page load');

  const next: Record<string, any> = { ...incoming };
  for (const key of PLATFORM_KEYS) {
    if (key in current) next[key] = current[key];
    else delete next[key];
  }
  const footer: Record<string, any> = isObject(incoming.footer) ? { ...incoming.footer } : {};
  for (const key of PLATFORM_FOOTER_KEYS) {
    if (current.footer && key in current.footer) footer[key] = current.footer[key];
    else delete footer[key];
  }
  next.footer = footer;
  return next;
}
