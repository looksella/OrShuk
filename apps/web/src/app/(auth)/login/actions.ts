// apps/web/src/app/(auth)/login/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { setSession } from '@/lib/auth-cookies';

const schema = z.object({
  email:    z.string().email('Correo invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});

export interface LoginState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return { error: 'No se pudo conectar con el servidor. Revisa que la API este encendida.' };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.message ?? 'Correo o contrasena incorrectos' };
  }

  const { accessToken, refreshToken } = await res.json();
  await setSession(accessToken, refreshToken);

  redirect('/dashboard');
}
