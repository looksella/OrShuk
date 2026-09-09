// apps/web/src/app/(app)/dashboard/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { clearSession } from '@/lib/auth-cookies';

export async function logoutAction() {
  const jar = await cookies();
  const refreshToken = jar.get('orshuk_refresh')?.value;

  if (refreshToken) {
    // Revocamos el token en el servidor. Si falla, igual cerramos
    // la sesion local: el usuario no debe quedar atrapado.
    await fetch(`${process.env.API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  await clearSession();
  redirect('/login');
}
