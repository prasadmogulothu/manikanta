// What an owner may set on staff and roles. Pure, so it can be tested on its own.

export const MIN_PASSWORD = 10;

// Only capabilities that do something today. The rest of the database's list arrives
// with their modules in Phase 8.
export const ASSIGNABLE_CAPS = ['content.edit', 'users.manage'];

export const validPassword = (p: unknown): p is string =>
  typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= 200;

// Login lower-cases what's typed, so usernames are stored that way.
export const cleanUsername = (u: unknown) => {
  const name = typeof u === 'string' ? u.trim().toLowerCase() : '';
  return /^[a-z0-9._-]{2,50}$/.test(name) ? name : null;
};

export const cleanRoleName = (n: unknown) => {
  const name = typeof n === 'string' ? n.trim() : '';
  return name && name.length <= 60 ? name : null;
};

export const validCaps = (caps: unknown): caps is string[] =>
  Array.isArray(caps) && caps.every((c) => ASSIGNABLE_CAPS.includes(c));

export const validRoleIds = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length <= 100 && ids.every((id) => typeof id === 'string' && /^\d{1,18}$/.test(id));

export const validUserId = (id: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
