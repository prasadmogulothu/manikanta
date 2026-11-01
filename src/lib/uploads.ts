import { randomUUID } from 'node:crypto';
import { AwsClient } from 'aws4fetch';

// A browser resizes first, for the owner's mobile data. The limits that count are
// here, because browser checks can be bypassed.
export const MAX_UPLOAD_BYTES = 2_000_000;
const EXT_OF: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };
const CACHE = 'public, max-age=31536000, immutable'; // filenames never repeat
const SIGN_SECONDS = 300;

export const allowedType = (type: unknown): type is string => typeof type === 'string' && Object.hasOwn(EXT_OF, type);

// Nothing the client sends reaches the key except a type from the list above.
export const keyFor = (slug: string, type: string) => `${slug}/${randomUUID()}.${EXT_OF[type]}`;

export const ownsKey = (slug: string, key: unknown) =>
  typeof key === 'string' && key.startsWith(`${slug}/`) &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(webp|jpg)$/.test(key.slice(slug.length + 1));

// The file's first bytes must match its extension.
export function bytesMatchKey(bytes: Uint8Array, key: string) {
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (key.endsWith('.jpg')) return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
}

const r2 = () =>
  new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  });
const objectUrl = (key: string) =>
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`;

// Type and length are signed, so R2 refuses anything else: nobody can store an HTML
// page or an oversized file with this link, even without calling confirm.
export async function signUpload(key: string, type: string, size: number) {
  const headers = { 'Content-Type': type, 'Cache-Control': CACHE };
  const { url } = await r2().sign(`${objectUrl(key)}?X-Amz-Expires=${SIGN_SECONDS}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Length': String(size) },
    aws: { signQuery: true, allHeaders: true },
  });
  return { url, key, headers };
}

export const deleteUpload = (key: string) => r2().fetch(objectUrl(key), { method: 'DELETE' });

// null: no such file. Otherwise whether the stored file is what it claims to be.
export async function verifyUpload(key: string) {
  const res = await r2().fetch(objectUrl(key), { headers: { Range: 'bytes=0-11' } });
  if (res.status === 404) return null;
  const size = Number(res.headers.get('content-range')?.split('/')[1]);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return res.status === 206 && size <= MAX_UPLOAD_BYTES && bytesMatchKey(bytes, key);
}
