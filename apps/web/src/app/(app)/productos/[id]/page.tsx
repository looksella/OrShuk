import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { obtenerProducto, obtenerHistorial } from '../actions';
import { ETIQUETAS_MOVIMIENTO } from '@/lib/schemas/producto';
import { PanelInventario } from '../_componentes/panel-inventario';

export default async function PaginaDetalleProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [producto, historial] = await Promise.all([
    obtenerProducto(id),
    obtenerHistorial(id),
  ]);

  if (!producto) notFound();
  const p = producto as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/productos"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Catalogo
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {p.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-400">
            {p.sku}{p.barcode && ` · ${p.barcode}`}
          </p>
        </div>

        <Link
          href={`/productos/${id}/editar`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" /> Editar
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PanelInventario producto={p} />

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Kardex de movimientos
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Historial completo. Los registros no se editan; las correcciones
                se hacen con ajustes.
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 text-xs font-medium uppercase text-slate-500">Fecha</th>
                  <th className="px-4 py-2 text-xs font-medium uppercase text-slate-500">Tipo</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-slate-500">Cantidad</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-slate-500">Saldo</th>
                  <th className="px-4 py-2 text-xs font-medium uppercase text-slate-500">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.items.map((m: any) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(m.occurredAt).toLocaleString('es-SV', {
                        day: '2-digit', month: 'short', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {ETIQUETAS_MOVIMIENTO[m.movementType] ?? m.movementType}
                      {m.reason && (
                        <span className="block text-xs text-slate-400">{m.reason}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                      Number(m.quantityDelta) > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {Number(m.quantityDelta) > 0 ? '+' : ''}
                      {Number(m.quantityDelta).toLocaleString('es-SV')}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                      {Number(m.balanceAfter).toLocaleString('es-SV')}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {m.usuario ?? 'Sistema'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {historial.items.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Sin movimientos registrados
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Datos</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Dato etiqueta="Categoria" valor={p.categoria ?? '—'} />
              <Dato etiqueta="Unidad" valor={p.unitCode} />
              <Dato etiqueta="Costo" valor={`$${Number(p.costPrice).toFixed(2)}`} />
              <Dato etiqueta="Venta" valor={`$${Number(p.salePrice).toFixed(2)}`} />
              <Dato etiqueta="IVA" valor={`${(Number(p.taxRate) * 100).toFixed(0)}%`} />
              <Dato etiqueta="Stock minimo" valor={Number(p.minStock).toLocaleString('es-SV')} />
              <Dato etiqueta="Estado" valor={p.isActive ? 'Activo' : 'Inactivo'} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="font-medium text-slate-900">{valor}</dd>
    </div>
  );
}
*/
