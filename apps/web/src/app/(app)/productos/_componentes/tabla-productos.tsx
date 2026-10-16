// ============================================================
// apps/web/src/app/(app)/productos/_componentes/tabla-productos.tsx
// ============================================================
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, History, PowerOff } from 'lucide-react';
import { ETIQUETAS_ESTADO_STOCK } from '@/lib/schemas/producto';
import { desactivarProducto } from '../actions';

type Item = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoria: string | null;
  unitCode: string;
  costPrice: string;
  salePrice: string;
  minStock: string;
  stock: string;
  estadoStock: string;
  isActive: boolean;
};

export function TablaProductos({
  items, total, page, totalPages,
}: {
  items: Item[];
  total: number;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);

  function irAPagina(p: number) {
    const nuevos = new URLSearchParams(sp.toString());
    nuevos.set('page', String(p));
    iniciar(() => router.push(`/productos?${nuevos}`));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm font-medium text-slate-700">
          No se encontraron productos
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Ajuste los filtros o cree el primer producto del catalogo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <Th>Producto</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Costo</Th>
              <Th className="text-right">Venta</Th>
              <Th className="text-right">Margen</Th>
              <Th className="text-right">Stock</Th>
              <Th>Estado</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => {
              const estado = ETIQUETAS_ESTADO_STOCK[p.estadoStock]
                ?? ETIQUETAS_ESTADO_STOCK.NO_APLICA;
              const margen = calcularMargen(p.costPrice, p.salePrice);

              return (
                <tr
                  key={p.id}
                  className={`transition hover:bg-slate-50 ${
                    !p.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/productos/${p.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {p.sku}
                      {p.barcode && ` · ${p.barcode}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.categoria ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {moneda(p.costPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                    {moneda(p.salePrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={
                      margen === null ? 'text-slate-400'
                        : margen < 10 ? 'text-red-600'
                        : margen < 25 ? 'text-amber-600'
                        : 'text-emerald-600'
                    }>
                      {margen === null ? '—' : `${margen.toFixed(0)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {p.estadoStock === 'NO_APLICA'
                      ? '—'
                      : `${Number(p.stock).toLocaleString('es-SV')} ${etiquetaUnidad(p.unitCode)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Acciones"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {abierto === p.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setAbierto(null)}
                          />
                          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                            <Link
                              href={`/productos/${p.id}/editar`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Link>
                            <Link
                              href={`/productos/${p.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <History className="h-3.5 w-3.5" /> Ver kardex
                            </Link>
                            {p.isActive && (
                              <button
                                onClick={() => {
                                  setAbierto(null);
                                  iniciar(async () => {
                                    await desactivarProducto(p.id);
                                    router.refresh();
                                  });
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <PowerOff className="h-3.5 w-3.5" /> Desactivar
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginacion */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-slate-500">
          {total.toLocaleString('es-SV')} producto{total === 1 ? '' : 's'}
          {totalPages > 1 && ` · pagina ${page} de ${totalPages}`}
        </p>

        {totalPages > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => irAPagina(page - 1)}
              disabled={page <= 1 || pendiente}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => irAPagina(page + 1)}
              disabled={page >= totalPages || pendiente}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

function moneda(v: string) {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(Number(v));
}

function calcularMargen(costo: string, venta: string): number | null {
  const c = Number(costo);
  const v = Number(venta);
  if (!c || c <= 0 || !v) return null;
  return ((v - c) / v) * 100;
}

function etiquetaUnidad(codigo: string) {
  const mapa: Record<string, string> = {
    UNIDAD: 'u', LIBRA: 'lb', KILO: 'kg', LITRO: 'L',
    CAJA: 'cj', FARDO: 'fd', QUINTAL: 'qq',
  };
  return mapa[codigo] ?? codigo.toLowerCase();
}
