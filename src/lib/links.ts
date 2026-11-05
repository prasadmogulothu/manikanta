// The address a request came to, which picks the site. The override is local only.
export const hostFromHeader = (host: string | null) =>
  (process.env.SITE_HOST_OVERRIDE || host || '').split(':')[0].toLowerCase();

// Stored image paths stay relative, so the image domain is this one setting.
export const asset = (p?: string) =>
  !p ? '' : /^https?:|^data:|^\//.test(p) ? p : `${process.env.NEXT_PUBLIC_IMAGE_BASE}/${p}`;

// Owners type these links, so anything that could run script is dropped.
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined;
  const h = href.trim();
  // Browsers ignore control characters and spaces inside a scheme, so "java\tscript:" still runs.
  if (/[\u0000- ]/.test(h)) return undefined;
  return /^(https?:\/\/|tel:|mailto:|#|\/(?!\/))/i.test(h) ? h : undefined;
}

// The menu as visitors see it: a link to a hidden section would go nowhere.
export function visibleNav(config: { nav?: any[]; sections?: any[] }): { label: string; href: string }[] {
  const hidden = (config.sections || []).filter((s) => s.enabled === false).map((s) => `#${s.config?.id}`);
  return (config.nav || []).filter((n) => n.label?.trim() && !hidden.includes(n.href));
}

// The product categories visitors can see, in the owner's order.
export const categories = (config: { sections?: any[] }) =>
  (config.sections || []).filter((s) => s.type === 'services' && s.enabled !== false && s.config?.catalog && s.config?.id);
export const categoryName = (s: any): string => s.config.heading || s.config.heading_2 || s.config.id;

export function safeMapUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const u = new URL(url);
    const google = u.hostname === 'maps.google.com' || u.hostname === 'www.google.com';
    return u.protocol === 'https:' && google && (u.hostname !== 'www.google.com' || u.pathname.startsWith('/maps'))
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

// A button can name an action instead of a link, so changing the shop's number
// updates every button that uses it.
export function ctaHref(cta: { action?: string; href?: string }, contact: Record<string, string> = {}) {
  if (cta.action === 'call') return contact.phone ? `tel:${contact.phone}` : undefined;
  if (cta.action === 'whatsapp') {
    if (!contact.whatsapp) return undefined;
    const text = contact.whatsapp_text ? `?text=${encodeURIComponent(contact.whatsapp_text)}` : '';
    return `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}${text}`;
  }
  return safeHref(cta.href);
}
