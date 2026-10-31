-- Core tables for all sites, ported from ../hh_site_builder/supabase without the
-- Supabase-specific parts (RLS policies, auth.*, storage.*, anon).
-- Tables for jobs, reviews, pages and events arrive with their modules in Phase 8.

-- The app's role. Created here, never in the Neon console: a console role joins
-- neon_superuser, which reads and writes every table whatever the grants below say,
-- and the owner can't take that away. `npm run db:app-password` lets it log in.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'hh_app') then
    create role hh_app nologin;
  end if;
  if pg_has_role('hh_app', 'pg_write_all_data', 'member') then
    raise exception 'hh_app can write every table. Delete it in the Neon console and run this again';
  end if;
end $$;

revoke create on schema public from public;
grant usage on schema public to hh_app;

create table hh_templates (
  key         text primary key,
  name        text not null,
  description text,
  tokens      jsonb not null default '{}',
  css         text,
  active      boolean not null default true,
  category    text not null default 'general'
    constraint hh_templates_category_known check (category in (
      'restaurant','service','repair','school','clinic',
      'retail','trade','community','general')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table hh_sites (
  id           uuid primary key default gen_random_uuid(),
  -- The slug is the first part of every R2 key, so it must be safe in a path.
  slug         text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  hostnames    text[] not null default '{}',
  template_key text not null references hh_templates(key),
  config       jsonb not null default '{}',
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index hh_sites_hostnames_idx on hh_sites using gin (hostnames);

create table hh_users (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references hh_sites(id) on delete cascade,
  username      text not null check (username = lower(username)),
  password_hash text not null,
  is_owner      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (site_id, username),
  unique (id, site_id)
);

create table hh_sessions (
  token_hash text primary key,
  user_id    uuid not null references hh_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index hh_sessions_user_idx on hh_sessions (user_id);

create table hh_login_attempts (
  site_id      uuid not null references hh_sites(id) on delete cascade,
  username     text not null,
  ip           text not null,
  failures     int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (site_id, username, ip)
);

-- The list of capabilities is closed so a typo is a write error, not a role that
-- silently grants nothing. `scoped` and hh_grants return with Events in Phase 8.
create table hh_roles (
  id         bigint generated always as identity primary key,
  site_id    uuid not null references hh_sites(id) on delete cascade,
  key        text not null,
  name       text not null,
  caps       text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (site_id, key),
  unique (id, site_id),
  constraint hh_roles_caps_known check (caps <@ array[
    'content.edit','pages.edit','events.edit','timetable.edit','gallery.edit',
    'jobs.edit','reviews.moderate','users.manage']::text[])
);

-- site_id appears in both foreign keys, so the database itself refuses to give a
-- user a role from another site.
create table hh_user_roles (
  site_id    uuid not null,
  user_id    uuid not null,
  role_id    bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id),
  foreign key (user_id, site_id) references hh_users(id, site_id) on delete cascade,
  foreign key (role_id, site_id) references hh_roles(id, site_id) on delete cascade
);
create index hh_user_roles_role_idx on hh_user_roles (role_id);

-- saved_by is the username as text, so history still reads correctly after a
-- staff member is removed.
create table hh_site_versions (
  id         bigint generated always as identity primary key,
  site_id    uuid not null references hh_sites(id) on delete cascade,
  config     jsonb not null,
  saved_by   text not null,
  created_at timestamptz not null default now()
);
create index hh_site_versions_site_idx on hh_site_versions (site_id, id desc);

-- The app may change a site's content, but not its name, hostnames, theme or
-- published state. Versions can be added and trimmed, never rewritten.
grant select on hh_templates, hh_sites to hh_app;
grant update (config, updated_at) on hh_sites to hh_app;
grant select, insert, update, delete
  on hh_users, hh_sessions, hh_login_attempts, hh_roles to hh_app;
grant select, insert, delete on hh_user_roles, hh_site_versions to hh_app;
