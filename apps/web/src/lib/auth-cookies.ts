// apps/web/src/lib/auth-cookies.ts
// Los tokens viven en cookies httpOnly, no en localStorage.
// Asi un script malicioso no puede leerlos.
import { cookies } from 'next/headers';

const ACCESS  = 'orshuk_token';
const REFRESH = 'orshuk_refresh';

export async function setSession(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  jar.set(ACCESS, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 minutos
  });

  jar.set(REFRESH, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS)?.value;
}
