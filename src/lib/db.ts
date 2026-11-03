import { revalidateTag } from 'next/cache';
import { neon } from '@neondatabase/serverless';
import type { Order } from './orders';
import { siteTag } from './site';

// Every function that touches a site's rows takes siteId first, and API routes only
// ever pass the one from the session.
const query = (text: string, params: unknown[] = []) => neon(process.env.DATABASE_URL!).query(text, params) as Promise<any[]>;

export const VERSIONS_KEPT = 30;

export const getSiteIdByHost = async (host: string): Promise<string | null> =>
  (await query('select id from hh_sites where $1 = any(hostnames)', [host]))[0]?.id ?? null;

export const getSiteSlug = async (siteId: string) =>
  (await query('select slug from hh_sites where id = $1', [siteId]))[0].slug as string;

export const getContent = async (siteId: string) =>
  (await query('select config, version from hh_sites where id = $1', [siteId]))[0] as { config: Record<string, any>; version: number };

export async function saveContent(siteId: string, config: unknown, baseVersion: number, savedBy: string) {
  // One statement, so the save and its snapshot can't come apart. The version check
  // in the update is what refuses a save based on an out-of-date copy.
  const rows = await query(
    `with up as (
       update hh_sites set config = $2, version = version + 1, updated_at = now()
        where id = $1 and version = $3
       returning id, config, version, hostnames
     ), snap as (
       insert into hh_site_versions (site_id, config, saved_by)
       select id, config, $4 from up
     ), trimmed as (
       delete from hh_site_versions
        where site_id = $1 and exists (select 1 from up)
          and id not in (select id from hh_site_versions where site_id = $1 order by id desc limit $5)
     )
     select version, hostnames from up`,
    [siteId, JSON.stringify(config), baseVersion, savedBy, VERSIONS_KEPT - 1],
  );
  if (!rows[0]) return null;
  for (const host of rows[0].hostnames) revalidateTag(siteTag(host), { expire: 0 });
  return rows[0].version as number;
}

export const listVersions = (siteId: string) =>
  query(
    'select id, saved_by, created_at from hh_site_versions where site_id = $1 order by id desc limit $2',
    [siteId, VERSIONS_KEPT],
  );

export const getVersionConfig = async (siteId: string, id: number) =>
  (await query('select config from hh_site_versions where site_id = $1 and id = $2', [siteId, id]))[0]?.config as
    | Record<string, any>
    | undefined;

// True only if every id is a role of this site, so another site's can't be assigned.
export const rolesBelongToSite = async (siteId: string, ids: string[]) =>
  (await query('select count(*)::int as n from hh_roles where site_id = $1 and id = any($2::bigint[])', [siteId, ids]))[0].n ===
  new Set(ids).size;

export const recentOrderCount = async (siteId: string, ip: string) =>
  (await query(
    `select count(*)::int as n from hh_orders where site_id = $1 and ip = $2 and created_at > now() - interval '1 hour'`,
    [siteId, ip],
  ))[0].n as number;

export const insertOrder = async (siteId: string, o: Order, ip: string) =>
  (await query(
    `insert into hh_orders (site_id, name, phone, address, items, total, ip)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [siteId, o.name, o.phone, o.address, JSON.stringify(o.items), o.total, ip],
  ))[0].id as string | number;

// ponytail: newest 200 only; add paging when a shop passes that.
export const listOrders = (siteId: string) =>
  query(
    `select id, name, phone, address, items, total, status, cancel_reason, created_at
       from hh_orders where site_id = $1 order by id desc limit 200`,
    [siteId],
  );

export const setOrderStatus = async (siteId: string, id: string, status: string, reason: string | null) =>
  (await query(
    'update hh_orders set status = $3, cancel_reason = $4, updated_at = now() where site_id = $1 and id = $2 returning id',
    [siteId, id, status, reason],
  )).length > 0;

export const siteTakesOrders = async (siteId: string) =>
  (await query(`select config->'features'->'orders' = 'true'::jsonb as on from hh_sites where id = $1`, [siteId]))[0]?.on === true;

export { query };
