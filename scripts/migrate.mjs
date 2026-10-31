// Applies migrations/NNN_*.sql in order, each in its own transaction. Laptop only:
// needs the owner connection, which Vercel never has.
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DIR = new URL('../migrations/', import.meta.url);

export async function migrate(client, dir = DIR) {
  await client.query(`create table if not exists hh_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const { rows } = await client.query('select name from hh_migrations');
  const done = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(new URL(file, dir), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into hh_migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw new Error(`${file}: ${err.message}`);
    }
    applied.push(file);
  }
  return applied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error('DATABASE_URL_OWNER is not set');
  const { Client } = await import('@neondatabase/serverless');
  const client = new Client(url);
  await client.connect();
  try {
    const applied = await migrate(client);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply');
  } finally {
    await client.end();
  }
}
