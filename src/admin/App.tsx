'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../lib/links';
import { ApiError, api } from './api';
import { LangContext, PasswordInput } from './Fields';
import { Roles, Users } from './people';
import Products from './Products';
import { ChangePassword, Flyers, History, HomeSections, SiteDetails } from './screens';

type Me = { username: string; isOwner: boolean; caps: string[] };
type Content = { config: Record<string, any>; version: number };

const CONTENT_SCREENS = [
  ['products', 'Products'],
  ['flyers', 'Flyers'],
  ['home', 'Home sections'],
  ['site', 'Site details'],
  ['history', 'History'],
] as const;

const PEOPLE_SCREENS = [
  ['users', 'Users'],
  ['roles', 'Roles'],
] as const;

type Brand = Record<string, string | undefined>;

function BrandMark({ brand, name }: { brand: Brand; name: string }) {
  return (
    <span className="brand">
      {brand.logo && <img src={asset(brand.logo)} alt="" />}
      <span>
        <b>
          {brand.wordmark || brand.name || name}
          {brand.wordmark_accent && <em> {brand.wordmark_accent}</em>}
        </b>
        {brand.tagline && <small>{brand.tagline}</small>}
      </span>
    </span>
  );
}

function Login({ onDone, brand, name }: { onDone: () => void; brand: Brand; name: string }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('POST', '/auth/login', form);
      onDone();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card stack" onSubmit={submit}>
        <BrandMark brand={brand} name={name} />
        <h1>Sign in</h1>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" autoCapitalize="none" required value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

export default function AdminApp({ brand: initialBrand = {}, name = '' }: { brand?: Brand; name?: string }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [saved, setSaved] = useState<Content | null>(null);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [screen, setScreen] = useState<string>('products');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string; stale?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const top = useRef<HTMLElement>(null);

  const canEdit = !!me && (me.isOwner || me.caps.includes('content.edit'));
  const canManage = !!me && (me.isOwner || me.caps.includes('users.manage'));
  const dirty = !!saved && !!draft && JSON.stringify(saved.config) !== JSON.stringify(draft);

  const loadContent = useCallback(async () => {
    const content = await api<Content>('GET', '/content');
    setSaved(content);
    setDraft(content.config);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const user = await api<Me>('GET', '/auth/me');
      setMe(user);
      if (user.isOwner || user.caps.includes('content.edit')) await loadContent();
      else setScreen(user.caps.includes('users.manage') ? 'users' : 'password');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
      else setStatus({ kind: 'error', text: (err as Error).message });
    }
  }, [loadContent]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    if (!saved || !draft) return;
    setSaving(true);
    setStatus(null);
    try {
      const { version } = await api<{ version: number }>('PUT', '/content', { config: draft, version: saved.version });
      // Reload rather than assume: the server keeps platform settings as they were.
      await loadContent();
      setStatus({ kind: 'ok', text: `Saved. The site is updated (save ${version}).` });
    } catch (err: any) {
      setStatus({ kind: 'error', text: err.message, stale: err instanceof ApiError && err.status === 409 });
    }
    setSaving(false);
  }

  function discard() {
    if (saved && window.confirm('Discard your unsaved changes?')) {
      setDraft(saved.config);
      setStatus(null);
    }
  }

  async function reload() {
    await loadContent();
    setStatus(null);
  }

  async function logout() {
    if (dirty && !window.confirm('Sign out and lose your unsaved changes?')) return;
    await api('POST', '/auth/logout').catch(() => {});
    setMe(null);
    setSaved(null);
    setDraft(null);
    setStatus(null);
  }

  function go(next: string) {
    setScreen(next);
    setStatus(null);
    top.current?.scrollIntoView();
  }

  if (me === undefined) {
    return status ? <main className="login"><p className="error" role="alert">{status.text}</p></main> : <main className="login muted">Loading…</main>;
  }
  if (me === null) return <Login onDone={loadMe} brand={initialBrand} name={name} />;

  const props = { config: draft!, setConfig: setDraft as (c: Record<string, any>) => void };
  return (
    <LangContext.Provider value={{ lang: draft?.lang, lang2: draft?.lang_2 }}>
      <header className="bar" ref={top}>
        <div className="bar-top">
          <BrandMark brand={draft?.brand || initialBrand} name={name} />
          <button type="button" className="link" onClick={logout}>Sign out</button>
        </div>
        <div className="bar-meta">
          <a href="/" target="_blank" rel="noopener">View site ↗</a>
          <span className="muted">{me.username}</span>
        </div>
        <nav aria-label="Admin">
          {canEdit && CONTENT_SCREENS.map(([key, label]) => (
            <button type="button" key={key} aria-current={screen === key ? 'page' : undefined} onClick={() => go(key)}>{label}</button>
          ))}
          {canManage && PEOPLE_SCREENS.map(([key, label]) => (
            <button type="button" key={key} aria-current={screen === key ? 'page' : undefined} onClick={() => go(key)}>{label}</button>
          ))}
          <button type="button" aria-current={screen === 'password' ? 'page' : undefined} onClick={() => go('password')}>Password</button>
        </nav>
      </header>

      <main className="screen">
        {screen === 'password' && <ChangePassword />}
        {canManage && screen === 'users' && <Users me={me.username} />}
        {canManage && screen === 'roles' && <Roles />}
        {canEdit && draft && saved && (
          <>
            {screen === 'products' && <Products {...props} />}
            {screen === 'flyers' && <Flyers {...props} />}
            {screen === 'home' && <HomeSections {...props} />}
            {screen === 'site' && <SiteDetails {...props} />}
            {screen === 'history' && <History version={saved.version} dirty={dirty} onRestored={loadContent} />}
          </>
        )}
      </main>

      {(dirty || status) && (
        <footer className="savebar" role="status">
          {status && <p className={status.kind === 'ok' ? 'ok' : 'error'}>{status.text}</p>}
          {status?.stale && <button type="button" className="secondary" onClick={reload}>Reload</button>}
          {dirty && !status?.stale && (
            <div className="row-actions">
              <button type="button" className="link" onClick={discard} disabled={saving}>Discard</button>
              <button type="button" className="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          )}
        </footer>
      )}
    </LangContext.Provider>
  );
}
