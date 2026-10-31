// Gives hh_app a new random password and writes its pooled URL to .env.local as
// DATABASE_URL. Also the way to rotate the password. Prints no secrets.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Client } from '@neondatabase/serverless';

const ENV_FILE = new URL('../.env.local', import.meta.url);
const owner = process.env.DATABASE_URL_OWNER;
if (!owner) throw new Error('DATABASE_URL_OWNER is not set');

const password = randomBytes(32).toString('hex'); // hex, so it's safe in SQL and URLs
const client = new Client(owner);
await client.connect();
await client.query(`alter role hh_app login password '${password}'`);
await client.end();

const url = new URL(owner);
url.username = 'hh_app';
url.password = password;
url.hostname = url.hostname.replace(/^([^.]+?)(-pooler)?\./, '$1-pooler.');

const env = await readFile(ENV_FILE, 'utf8');
const line = `DATABASE_URL=${url}`;
await writeFile(ENV_FILE, /^DATABASE_URL=.*$/m.test(env)
  ? env.replace(/^DATABASE_URL=.*$/m, line)
  : `${env.trimEnd()}\n${line}\n`);
console.log('hh_app password set; DATABASE_URL updated in .env.local');
