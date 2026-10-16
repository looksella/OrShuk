// ============================================================
// apps/web/src/app/(app)/productos/_componentes/barra-filtros.tsx
// ============================================================
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export function BarraFiltros({
  categorias,
}: {
  categorias: { id: string; name: string; productos: number }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(sp.get('q') ?? '');
  const primeraVez = useRef(true);

  // Debounce de 350 ms: espera a que el usuario termine de
  // escribir antes de pegarle a la base. Sin esto, "coca-cola"
  // dispararia diez consultas.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }

    const t = setTimeout(() => {
      const nuevos = new URLSearchParams(sp.toString());
      if (texto.trim()) nuevos.set('q', texto.trim());
      else nuevos.delete('q');
      nuevos.set('page', '1');
      iniciar(() => router.push(`/productos?${nuevos}`));
    }, 350);

    return () => clearTimeout(t);
  }, [texto]);

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(sp.toString());
    if (valor && valor !== 'todos') nuevos.set(clave, valor);
    else nuevos.delete(clave);
    nuevos.set('page', '1');
    iniciar(() => router.push(`/productos?${nuevos}`));
  }

  const hayFiltros = Boolean(
    sp.get('q') || sp.get('categoryId') ||
    (sp.get('stock') && sp.get('stock') !== 'todos') ||
    (sp.get('estado') && sp.get('estado') !== 'activos'),
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {/* Buscador */}
      <div className="relative min-w-[240px] flex-1">
        {pendiente ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, codigo o codigo de barras"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
        />
        {texto && (
          <button
            onClick={() => setTexto('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Limpiar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Categoria */}
      <select
        value={sp.get('categoryId') ?? ''}
        onChange={(e) => cambiar('categoryId', e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
      >
        <option value="">Todas las categorias</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.productos})
          </option>
        ))}
      </select>

      {/* Estado de stock */}
      <select
        value={sp.get('stock') ?? 'todos'}
        onChange={(e) => cambiar('stock', e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
      >
        <option value="todos">Todo el stock</option>
        <option value="ok">Disponibles</option>
        <option value="bajo">Stock bajo</option>
        <option value="agotado">Agotados</option>
      </select>

      {/* Activo / inactivo */}
      <select
        value={sp.get('estado') ?? 'activos'}
        onChange={(e) => cambiar('estado', e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
      >
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
        <option value="todos">Todos</option>
      </select>

      {hayFiltros && (
        <button
          onClick={() => iniciar(() => router.push('/productos'))}
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
