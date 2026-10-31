import { unstable_cache } from 'next/cache';
import { neon } from '@neondatabase/serverless';
import type { Site } from './types';

export const siteTag = (host: string) => `site:${host}`;

// The public site reads the database only on a cache miss. A save refreshes the
// page by calling revalidateTag(siteTag(host)) for each of the site's hostnames.
export function getSite(host: string): Promise<Site | null> {
  return unstable_cache(
    async () => {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        select s.id, s.slug, s.name, s.hostnames, s.config,
               json_build_object('tokens', t.tokens, 'css', t.css) as template
          from hh_sites s
          join hh_templates t on t.key = s.template_key
         where ${host} = any(s.hostnames) and s.published
         limit 1`;
      return (rows[0] as Site | undefined) ?? null;
    },
    ['site', host],
    { tags: [siteTag(host)] },
  )();
}
