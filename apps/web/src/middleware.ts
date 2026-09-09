// Va en: apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const RUTAS_PUBLICAS = ['/login', '/registro', '/recuperar'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('orshuk_token')?.value;
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  if (!token && !esPublica) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (token && esPublica) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
