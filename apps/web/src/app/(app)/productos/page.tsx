import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Package, AlertTriangle, DollarSign, Boxes } from 'lucide-react';
import { obtenerProductos, obtenerCategorias, obtenerResumen } from './actions';
import { TablaProductos } from './_componentes/tabla-productos';
import { BarraFiltros } from './_componentes/barra-filtros';

export const metadata = { title: 'Productos · OrShuk' };

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PaginaProductos({ searchParams }: Props) {
  const sp = await searchParams;

  const params: Record<string, string> = {
    page: sp.page ?? '1',
    pageSize: sp.pageSize ?? '20',
    orderBy: sp.orderBy ?? 'name',
    order: sp.order ?? 'asc',
    estado: sp.estado ?? 'activos',
    stock: sp.stock ?? 'todos',
  };
  if (sp.q) params.q = sp.q;
  if (sp.categoryId) params.categoryId = sp.categoryId;

  const [resultado, categorias, resumen] = await Promise.all([
    obtenerProductos(params),
    obtenerCategorias(),
    obtenerResumen(),
  ]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Productos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Catalogo e inventario de la sucursal
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/productos/inventario"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Boxes className="h-4 w-4" />
            Inventario
          </Link>
          <Link
            href="/productos/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Link>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      {resumen && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta
            icono={<Package className="h-4 w-4" />}
            etiqueta="Productos activos"
            valor={String(resumen.totalProductos ?? 0)}
          />
          <Tarjeta
            icono={<DollarSign className="h-4 w-4" />}
            etiqueta="Valor al costo"
            valor={formatoMoneda(resumen.valorCosto)}
          />
          <Tarjeta
            icono={<DollarSign className="h-4 w-4" />}
            etiqueta="Valor a precio venta"
            valor={formatoMoneda(resumen.valorVenta)}
          />
          <Tarjeta
            icono={<AlertTriangle className="h-4 w-4" />}
            etiqueta="Requieren atencion"
            valor={`${Number(resumen.bajos ?? 0) + Number(resumen.agotados ?? 0)}`}
            detalle={`${resumen.agotados ?? 0} agotados · ${resumen.bajos ?? 0} bajos`}
            alerta={Number(resumen.agotados ?? 0) > 0}
          />
        </div>
      )}

      {/* Filtros */}
      <BarraFiltros categorias={categorias} />

      {/* Tabla */}
      <Suspense fallback={<EsqueletoTabla />}>
        <TablaProductos
          items={resultado.items}
          total={resultado.total}
          page={resultado.page}
          totalPages={resultado.totalPages}
        />
      </Suspense>
    </div>
  );
}

// ------------------------------------------------------------
function Tarjeta({
  icono, etiqueta, valor, detalle, alerta,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-500">
        <span className={alerta ? 'text-amber-600' : ''}>{icono}</span>
        <span className="text-xs font-medium uppercase tracking-wide">
          {etiqueta}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${
        alerta ? 'text-amber-700' : 'text-slate-900'
      }`}>
        {valor}
      </p>
      {detalle && <p className="mt-1 text-xs text-slate-400">{detalle}</p>}
    </div>
  );
}

function EsqueletoTabla() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function formatoMoneda(v: unknown) {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}
