import { NextResponse, type NextRequest } from 'next/server';
import { hostFromHeader } from './lib/links';

// Every site is one domain on one deployment, so the hostname picks the site. It
// becomes part of the path, which is what makes pages cache per site.
export function proxy(req: NextRequest) {
  const host = hostFromHeader(req.headers.get('host'));
  if (!/^[a-z0-9.-]+$/.test(host)) return new NextResponse('Bad host', { status: 400 });
  const url = req.nextUrl.clone();
  url.pathname = `/${host}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: '/((?!api/|admin(?:/|$)|_next/).*)' };
