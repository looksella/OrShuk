// apps/web/src/app/(auth)/registro/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { setSession } from '@/lib/auth-cookies';

const schema = z.object({
  businessName: z.string().min(3, 'Nombre muy corto').max(160),
  slug: z.string()
    .min(3, 'Minimo 3 caracteres')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones'),
  fullName: z.string().min(3, 'Nombre muy corto').max(160),
  email:    z.string().email('Correo invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres').max(72),
});

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    businessName: formData.get('businessName'),
    slug:         formData.get('slug'),
    fullName:     formData.get('fullName'),
    email:        formData.get('email'),
    password:     formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.API_URL}/api/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return { error: 'No se pudo conectar con el servidor.' };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    return { error: msg ?? 'No se pudo crear la cuenta' };
  }

  const { accessToken, refreshToken } = await res.json();
  await setSession(accessToken, refreshToken);

  redirect('/dashboard');
}
