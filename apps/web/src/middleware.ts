// apps/web/src/middleware.ts
// REEMPLAZA el archivo que ya tienes.
import { NextResponse, type NextRequest } from 'next/server';

const PUBLICAS = ['/login', '/registro', '/recuperar'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('orshuk_token')?.value;
  const refresh = req.cookies.get('orshuk_refresh')?.value;
  const esPublica = PUBLICAS.some((r) => pathname.startsWith(r));

  // La raiz manda al dashboard o al login segun la sesion.
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token || refresh ? '/dashboard' : '/login', req.url),
    );
  }

  // Sin ninguna cookie de sesion y ruta privada -> al login.
  if (!token && !refresh && !esPublica) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Con sesion viva no tiene sentido ver el login.
  if (token && esPublica) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
