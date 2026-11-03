-- Orders placed from the site's cart. The app records them and moves their status,
-- but can never delete, re-price or move one to another site.
alter table hh_roles drop constraint hh_roles_caps_known;
alter table hh_roles add constraint hh_roles_caps_known check (caps <@ array[
  'content.edit','pages.edit','events.edit','timetable.edit','gallery.edit',
  'jobs.edit','reviews.moderate','users.manage','orders.manage']::text[]);

-- items holds each line as priced when ordered, so later product edits don't change it.
-- ip is kept only to limit how many orders one connection can place.
create table hh_orders (
  id            bigint generated always as identity primary key,
  site_id       uuid not null references hh_sites(id) on delete cascade,
  name          text not null,
  phone         text not null,
  address       text not null,
  items         jsonb not null,
  total         int not null,
  status        text not null default 'received'
    check (status in ('received','delivered','cancelled')),
  cancel_reason text,
  ip            text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index hh_orders_site_idx on hh_orders (site_id, id desc);
create index hh_orders_ip_idx on hh_orders (ip, created_at);

grant select, insert on hh_orders to hh_app;
grant update (status, cancel_reason, updated_at) on hh_orders to hh_app;
