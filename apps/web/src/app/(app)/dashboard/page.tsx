// apps/web/src/app/(app)/dashboard/page.tsx
// Server Component: los datos se piden en el servidor con el token
// de la cookie httpOnly. El navegador nunca ve el token.
import { redirect } from 'next/navigation';
import { LogOut, Store, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAccessToken } from '@/lib/auth-cookies';
import { logoutAction } from './actions';

interface MeResponse {
  user:   { id: string; email: string; fullName: string; role: string };
  tenant: { id: string; name: string; slug: string; plan: string };
}

async function fetchMe(): Promise<MeResponse | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(`${process.env.API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return res.json();
}

const ROLES: Record<string, string> = {
  owner:   'Propietario',
  admin:   'Administrador',
  manager: 'Encargado',
  cashier: 'Cajero',
};

export default async function DashboardPage() {
  const data = await fetchMe();
  if (!data) redirect('/login');

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{data.tenant.name}</h1>
            <p className="text-sm text-muted-foreground">
              Plan {data.tenant.plan} · {data.tenant.slug}
            </p>
          </div>
          <form action={logoutAction}>
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </form>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Sesion activa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{data.user.fullName}</p>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
              <p className="mt-2 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {ROLES[data.user.role] ?? data.user.role}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{data.tenant.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {data.tenant.id}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siguiente paso</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            La autenticacion funciona. En la Semana 3 se construye el modulo
            de productos e inventario, y luego la pantalla del punto de venta.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
