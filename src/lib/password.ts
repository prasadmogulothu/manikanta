import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Stored as scrypt$N$r$p$salt$hash, so the cost can rise later without breaking
// existing passwords. Also used by scripts/create-owner.mjs, so no aliases here.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const maxmem = 128 * N * R * 2;

const derive = (password: string, salt: Buffer, options: ScryptOptions, keylen: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P, maxmem }, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: +n, r: +r, p: +p, maxmem }, expected.length);
  return timingSafeEqual(key, expected);
}

// Spends the same time on an unknown username, so timing doesn't reveal which exist.
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEYLEN).toString('base64')}`;
