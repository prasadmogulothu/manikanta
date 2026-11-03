import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { PasswordInput } from './Fields';

type Role = { id: string; name: string; caps: string[]; users: number };
type User = { id: string; username: string; is_owner: boolean; role_ids: string[] };

// Duplicated from lib/users.ts for the labels; the API refuses anything else.
const CAP_LABELS: Record<string, string> = {
  'content.edit': 'Edit products, flyers and site content',
  'users.manage': 'Manage users and roles',
  'orders.manage': 'See and update orders',
};

const toggled = (list: string[], item: string, on: boolean) => (on ? [...list, item] : list.filter((x) => x !== item));

function useMessage() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Every action reports its own result, so a failure is never silent on a phone.
  const run = useCallback(async (action: () => Promise<unknown>, done?: string) => {
    setMessage(null);
    try {
      await action();
      if (done) setMessage({ ok: true, text: done });
      return true;
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
      return false;
    }
  }, []);
  const view = message && <p className={message.ok ? 'ok' : 'error'} role="alert">{message.text}</p>;
  return { run, view };
}

export function Users({ me }: { me: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({ username: '', password: '', roleIds: [] as string[] });
  const { run, view } = useMessage();

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([api('GET', '/users'), api('GET', '/roles')]);
    setUsers(u.users);
    setRoles(r.roles);
  }, []);
  useEffect(() => { run(load); }, [run, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const added = await run(async () => {
      await api('POST', '/users', form);
      await load();
    }, `${form.username} can now sign in.`);
    if (added) setForm({ username: '', password: '', roleIds: [] });
  }

  function reset(u: User) {
    const password = window.prompt(`New password for ${u.username}, at least 10 characters`);
    if (password) run(() => api('PATCH', `/users/${u.id}`, { password }), `Password changed. ${u.username} has been signed out.`);
  }

  function remove(u: User) {
    if (window.confirm(`Remove ${u.username}? They won't be able to sign in.`)) {
      run(async () => {
        await api('DELETE', `/users/${u.id}`);
        await load();
      }, `${u.username} has been removed.`);
    }
  }

  const setUserRoles = (u: User, roleIds: string[]) =>
    run(async () => {
      await api('PATCH', `/users/${u.id}`, { roleIds });
      await load();
    });

  return (
    <div className="stack">
      <h1>Users</h1>
      {view}
      {users === null && <p className="muted">Loading…</p>}
      {users?.map((u) => (
        <section className="card" key={u.id}>
          <div className="row-title">
            <b>{u.username}{u.username === me ? ' (you)' : ''}</b>
            {u.is_owner && <small>Owner, can do everything</small>}
          </div>
          {!u.is_owner && (
            <>
              {roles.map((r) => (
                <label className="check" key={r.id}>
                  <input type="checkbox" checked={u.role_ids.includes(r.id)}
                    onChange={(e) => setUserRoles(u, toggled(u.role_ids, r.id, e.target.checked))} /> {r.name}
                </label>
              ))}
              {u.username !== me && (
                <div className="row-actions">
                  <button type="button" className="secondary" onClick={() => reset(u)}>Reset password</button>
                  <button type="button" className="link danger" onClick={() => remove(u)}>Remove</button>
                </div>
              )}
            </>
          )}
        </section>
      ))}

      <form className="card" onSubmit={add}>
        <h2>Add staff</h2>
        <div className="field">
          <label htmlFor="new-username">Username</label>
          <input id="new-username" autoCapitalize="none" autoComplete="off" required value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-password">Password</label>
          <PasswordInput id="new-password" autoComplete="new-password" required minLength={10} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <small>At least 10 characters. Give it to them; they can change it after signing in.</small>
        </div>
        {roles.length === 0 && <p className="muted">No roles yet, so this person could only change their password. Create a role first.</p>}
        {roles.map((r) => (
          <label className="check" key={r.id}>
            <input type="checkbox" checked={form.roleIds.includes(r.id)}
              onChange={(e) => setForm({ ...form, roleIds: toggled(form.roleIds, r.id, e.target.checked) })} /> {r.name}
          </label>
        ))}
        <button type="submit" className="primary">Add staff</button>
      </form>
    </div>
  );
}

function RoleForm({ role, onSave, onDelete }: {
  role?: Role;
  onSave: (name: string, caps: string[]) => Promise<boolean>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [caps, setCaps] = useState(role?.caps ?? []);
  const id = role ? `role-${role.id}` : 'new-role';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((await onSave(name, caps)) && !role) {
      setName('');
      setCaps([]);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      {!role && <h2>Create a role</h2>}
      <div className="field">
        <label htmlFor={id}>Role name</label>
        <input id={id} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        {role && <small>{role.users} {role.users === 1 ? 'person has' : 'people have'} this role</small>}
      </div>
      {Object.entries(CAP_LABELS).map(([cap, label]) => (
        <label className="check" key={cap}>
          <input type="checkbox" checked={caps.includes(cap)} onChange={(e) => setCaps(toggled(caps, cap, e.target.checked))} /> {label}
        </label>
      ))}
      <div className="row-actions">
        <button type="submit" className={role ? 'secondary' : 'primary'}>{role ? 'Save role' : 'Create role'}</button>
        {onDelete && <button type="button" className="link danger" onClick={onDelete}>Delete</button>}
      </div>
    </form>
  );
}

export function Roles() {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const { run, view } = useMessage();

  const load = useCallback(async () => setRoles((await api('GET', '/roles')).roles), []);
  useEffect(() => { run(load); }, [run, load]);

  function remove(r: Role) {
    const who = r.users ? ` ${r.users} ${r.users === 1 ? 'person' : 'people'} will lose what it allows.` : '';
    if (window.confirm(`Delete the role ${r.name}?${who}`)) {
      run(async () => {
        await api('DELETE', `/roles/${r.id}`);
        await load();
      }, 'Role deleted.');
    }
  }

  return (
    <div className="stack">
      <h1>Roles</h1>
      <p className="muted">A role is what a staff member may do. The owner can always do everything.</p>
      {view}
      {roles === null && <p className="muted">Loading…</p>}
      {roles?.map((r) => (
        <RoleForm key={r.id} role={r} onDelete={() => remove(r)}
          onSave={(name, caps) => run(async () => {
            await api('PATCH', `/roles/${r.id}`, { name, caps });
            await load();
          }, 'Role saved.')} />
      ))}
      <RoleForm onSave={(name, caps) => run(async () => {
        await api('POST', '/roles', { name, caps });
        await load();
      }, 'Role created.')} />
    </div>
  );
}
