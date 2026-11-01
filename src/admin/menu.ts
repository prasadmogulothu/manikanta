// The top menu: chosen categories, in the order they're listed, then the fixed links.
// config.nav stays the one source, so the site's header doesn't need to know about any of this.
// Pure, so scripts/modules.check.mjs can test it.

type Link = { label?: string; label_2?: string; href?: string };

// A category is a services section marked catalog; other sections are Home sections.
export const isCategory = (s: any) => s.type === 'services' && s.config?.catalog === true;

export const menuHref = (s: any) => `#${s.config?.id}`;

const categoryHrefs = (sections: any[]) => sections.filter(isCategory).map(menuHref);

export const isFixedLink = (link: Link, sections: any[]) => !categoryHrefs(sections).includes(link.href as string);

export function orderMenu(nav: Link[], sections: any[]) {
  const chosen = categoryHrefs(sections).flatMap((href) => nav.filter((n) => n.href === href));
  return [...chosen, ...nav.filter((n) => isFixedLink(n, sections))];
}

export function setInMenu(nav: Link[], sections: any[], category: any, on: boolean) {
  const href = menuHref(category);
  const others = nav.filter((n) => n.href !== href);
  if (!on) return others;
  const { heading, heading_2 } = category.config;
  return orderMenu([...others, { label: heading || heading_2 || '', href }], sections);
}
