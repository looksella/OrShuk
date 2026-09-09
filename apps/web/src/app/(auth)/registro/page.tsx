// apps/web/src/app/(auth)/registro/page.tsx
'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registerAction, type RegisterState } from './actions';

// Convierte "Tienda La Esquina" en "tienda-la-esquina"
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

export default function RegistroPage() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    {},
  );
  const [slug, setSlug] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Registra tu negocio</CardTitle>
          <CardDescription>Crea tu cuenta en OrShuk</CardDescription>
        </CardHeader>

        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Nombre del negocio</Label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Tienda La Esquina"
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
              />
              {state.fieldErrors?.businessName && (
                <p className="text-sm text-destructive">{state.fieldErrors.businessName[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identificador</Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se genera solo. Lo usaras si tu correo pertenece a varios negocios.
              </p>
              {state.fieldErrors?.slug && (
                <p className="text-sm text-destructive">{state.fieldErrors.slug[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Tu nombre</Label>
              <Input id="fullName" name="fullName" placeholder="Juan Perez" required />
              {state.fieldErrors?.fullName && (
                <p className="text-sm text-destructive">{state.fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
              {state.fieldErrors?.email && (
                <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">Minimo 8 caracteres.</p>
              {state.fieldErrors?.password && (
                <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
              )}
            </div>

            {state.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Ingresa
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
