import { json, withAuth } from '@/lib/auth';
import { listVersions } from '@/lib/db';

export const GET = withAuth('content.edit', async (_req, ctx) => json({ versions: await listVersions(ctx.siteId) }));
