import { asset, safeHref, visibleNav } from '../lib/links';
import type { Site } from '../lib/types';
import { Icon } from '../modules/icons';

// Page chrome. Config-driven: no site name, phone number or logo path is written here.

const LABELS: Record<string, { skip: string; menu: string }> = {
  te: { skip: 'ప్రధాన విషయానికి వెళ్ళండి', menu: 'ప్రధాన మెను' },
  en: { skip: 'Skip to main content', menu: 'Main menu' },
};
const labels = (site: Site) => LABELS[site.config.lang] || LABELS.en;

export const SkipLink = ({ site }: { site: Site }) => (
  <a className="skip" href="#main">{labels(site).skip}</a>
);

export function Header({ site }: { site: Site }) {
  const b = site.config.brand || {};
  const k = site.config.contact || {};
  const nav = visibleNav(site.config);
  return (
    <header className="top">
      {b.badge && <div className="top-badge">{b.badge}</div>}
      <a className="top-brand" href="#top">
        {b.logo && <img src={asset(b.logo)} alt="" />}
        <div>
          <b>
            {b.wordmark || b.name || site.name}
            {b.wordmark_accent && <em> {b.wordmark_accent}</em>}
          </b>
          {b.tagline && <small>{b.tagline}</small>}
        </div>
      </a>
      {nav.length > 0 && (
        <nav className="top-nav" aria-label={labels(site).menu}>
          {nav.map((n) => (
            <a key={n.href} href={safeHref(n.href)}>{n.label}</a>
          ))}
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
        </div>
        {f.powered_by &&
          (url ? (
            <a className="pb" href={url} target="_blank" rel="noopener">{credit}</a>
          ) : (
            <div className="pb">{credit}</div>
          ))}
      </div>
    </footer>
  );
}
