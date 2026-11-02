// Two languages with no module knowing about them: `x` is the main language and `x_2`
// the second. Pure, so scripts/modules.check.mjs can test it.

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const text = (v: unknown) => v == null || typeof v === 'string';

// For the second language every `x` / `x_2` pair is swapped, so a module that shows
// `title` big and `title_2` small shows the visitor's language first. A missing
// translation falls back to the other language, never a blank.
export function localize<T>(value: T, second: boolean): T {
  if (Array.isArray(value)) return value.map((v) => localize(v, second)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) out[k] = localize(v, second);
  for (const k2 of Object.keys(out)) {
    const k = k2.slice(0, -2);
    if (!k2.endsWith('_2') || !text(out[k]) || !text(out[k2])) continue;
    const [want, other] = second ? [out[k2], out[k]] : [out[k], out[k2]];
    out[k] = filled(want) ? want : other;
    out[k2] = filled(want) && filled(other) ? other : undefined;
  }
  return out as T;
}

export type Page = { lang: string; path: string; other?: { lang: string; path: string } };

// `/` is the site's main language and `/<lang_2>` the second. Anything else is no page.
export function pageFor(config: { lang?: string; lang_2?: string }, segments: string[] = []): Page | null {
  const main = config.lang || 'en';
  const second = config.lang_2;
  if (!segments.length) return { lang: main, path: '/', other: second ? { lang: second, path: `/${second}` } : undefined };
  if (segments.length === 1 && second && segments[0] === second) return { lang: second, path: `/${second}`, other: { lang: main, path: '/' } };
  return null;
}

// The page's config in its own language, with `lang` naming it.
export const configFor = (config: Record<string, any>, page: Page) => ({
  ...localize(config, page.path !== '/'),
  lang: page.lang,
  lang_2: page.other?.lang,
});
