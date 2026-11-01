// base.css → template.tokens → template.css → site.config.theme. Order is the whole
// mechanism: a site overrides single tokens without forking its template.
type Tokens = Record<string, string> | undefined;

// A stray "</style" in stored CSS would end the element and dump the rest as markup.
const safeCss = (s: string | null | undefined) => String(s || '').replace(/<\/(style)/gi, '<\\/$1');

// Token values land in a declaration block, so ; { } could write arbitrary rules.
export const toVars = (tokens: Tokens) =>
  Object.entries(tokens || {})
    .map(([k, v]) => `--${k}:${String(v).replace(/[;{}]/g, '')};`)
    .join('');

const FONT_KEYS = ['font-display', 'font-body', 'font-mono', 'font-2'];

export function fontHref(tokens: Tokens) {
  const families = [...new Set(FONT_KEYS.map((k) => tokens?.[k]).filter(Boolean) as string[])];
  if (!families.length) return null;
  const spec = families.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`;
}

export function composeCss(template: { tokens?: Tokens; css?: string | null }, overrides: Tokens) {
  return [`:root{${toVars(template.tokens)}}`, safeCss(template.css), `:root{${toVars(overrides)}}`].join('\n');
}
