import { asset, categories, safeHref, visibleNav } from '../lib/links';
import type { Site } from '../lib/types';
import { Icon } from '../modules/icons';

// Page chrome. Config-driven: no site name, phone number or logo path is written here.

// Page labels stay English; only what the owner types appears in the site's language.
const LABELS = { skip: 'Skip to main content', menu: 'Main menu' };
const labels = (_site: Site) => LABELS;

export const SkipLink = ({ site }: { site: Site }) => (
  <a className="skip" href="#main">{labels(site).skip}</a>
);

// home: '/' when the header sits on another page, so its #section links lead back home.
export function Header({ site, home = '' }: { site: Site; home?: string }) {
  const b = site.config.brand || {};
  const k = site.config.contact || {};
  const nav = visibleNav(site.config);
  const cats = categories(site.config).map((s) => `#${s.config.id}`);
  // "All categories" goes after the category links, before fixed ones such as About.
  const at = nav.findIndex((n) => !cats.includes(n.href));
  const allAt = cats.length ? (at < 0 ? nav.length : at) : -1;
  const all = <a key="/categories" href="/categories">All categories</a>;
  return (
    <header className="top">
      {b.badge && <div className="top-badge">{b.badge}</div>}
      <a className="top-brand" href={`${home}#top`}>
        {b.logo && <img src={asset(b.logo)} alt="" />}
        <div>
          <b>
            {b.wordmark || b.name || site.name}
            {b.wordmark_accent && <em> {b.wordmark_accent}</em>}
          </b>
          {b.tagline && <small>{b.tagline}</small>}
        </div>
      </a>
      {(nav.length > 0 || allAt >= 0) && (
        <nav className="top-nav" aria-label={labels(site).menu}>
          {nav.map((n, i) => [
            i === allAt && all,
            <a key={n.href} href={safeHref(n.href?.startsWith('#') ? home + n.href : n.href)}>{n.label}</a>,
          ])}
          {allAt === nav.length && all}
        </nav>
      )}
      {k.phone && (
        <a className="top-call" href={`tel:${k.phone}`}>
          <Icon name="phone" size={17} /> {k.phone_display || k.phone}
        </a>
      )}
    </header>
  );
}

export function Footer({ site }: { site: Site }) {
  const f = site.config.footer || {};
  const credit = (
    <>
      <span>{f.powered_by_label || 'Powered by'}</span>
      <b>{f.powered_by}</b>
      {f.powered_by_logo && <img src={asset(f.powered_by_logo)} alt={`${f.powered_by} logo`} />}
    </>
  );
  const url = safeHref(f.powered_by_url);
  return (
    <footer className="foot">
      <div className="foot-in">
        <div>
          <b>{site.config.brand?.name || site.name}</b> &copy; {new Date().getFullYear()}
          {f.note && <small>{f.note}</small>}
          {site.config.features?.orders === true && (
            <small><a href="/privacy">Privacy</a></small>
          )}
        </div>
        {f.powered_by && (
          <div className="pb-wrap">
            {url ? (
              <a className="pb" href={url} target="_blank" rel="noopener">{credit}</a>
            ) : (
              <div className="pb">{credit}</div>
            )}
            {/* ponytail: the platform's own link, the same on every site; move it into footer config if a site needs another. */}
            <a className="pb-more" href="https://padamz.com" target="_blank" rel="noopener">padamz.com</a>
          </div>
        )}
      </div>
    </footer>
  );
}
