// ============================================================
// apps/web/src/app/(app)/productos/_componentes/panel-inventario.tsx
// ============================================================
'use client';

import { useActionState, useState } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight, ClipboardCheck } from 'lucide-react';
import { registrarMovimiento, ajustarInventario } from '../actions';
import { ETIQUETAS_MOVIMIENTO } from '@/lib/schemas/producto';

export function PanelInventario({
  producto,
}: {
  producto: { id: string; name: string; stock: string; unitCode: string; trackStock: boolean };
}) {
  const [pestana, setPestana] = useState<'entrada' | 'salida' | 'conteo'>('entrada');
  const [estadoMov, enviarMov, pendienteMov] = useActionState(registrarMovimiento, { ok: false });
  const [estadoAj, enviarAj, pendienteAj] = useActionState(ajustarInventario, { ok: false });

  if (!producto.trackStock) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Este producto no controla existencias.
      </div>
    );
  }

  const estado = pestana === 'conteo' ? estadoAj : estadoMov;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Saldo actual */}
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Existencia actual
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {Number(producto.stock).toLocaleString('es-SV')}
          <span className="ml-1.5 text-base font-normal text-slate-400">
            {producto.unitCode.toLowerCase()}
          </span>
        </p>
      </div>

      {/* Pestanas */}
      <div className="flex border-b border-slate-200">
        <Pestana activa={pestana === 'entrada'} onClick={() => setPestana('entrada')}
                 icono={<ArrowUpRight className="h-4 w-4" />}>
          Entrada
        </Pestana>
        <Pestana activa={pestana === 'salida'} onClick={() => setPestana('salida')}
                 icono={<ArrowDownRight className="h-4 w-4" />}>
          Salida
        </Pestana>
        <Pestana activa={pestana === 'conteo'} onClick={() => setPestana('conteo')}
                 icono={<ClipboardCheck className="h-4 w-4" />}>
          Conteo fisico
        </Pestana>
      </div>

      <div className="p-5">
        {estado.mensaje && (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${
            estado.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            {estado.mensaje}
          </div>
        )}

        {/* Entrada o salida */}
        {pestana !== 'conteo' && (
          <form action={enviarMov} className="space-y-4" key={pestana}>
            <input type="hidden" name="productId" value={producto.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Motivo
                </label>
                <select
                  name="movementType"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  defaultValue={pestana === 'entrada' ? 'COMPRA' : 'MERMA'}
                >
                  {(pestana === 'entrada'
                    ? ['COMPRA', 'DEVOLUCION_CLIENTE', 'TRASLADO_ENTRADA', 'AJUSTE_POSITIVO']
                    : ['MERMA', 'DEVOLUCION_PROVEEDOR', 'TRASLADO_SALIDA', 'AJUSTE_NEGATIVO']
                  ).map((t) => (
                    <option key={t} value={t}>{ETIQUETAS_MOVIMIENTO[t]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Cantidad
                </label>
                <input
                  name="quantity"
                  inputMode="decimal"
                  placeholder="12"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {pestana === 'entrada' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Costo unitario <span className="text-slate-400">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    name="unitCost"
                    inputMode="decimal"
                    placeholder="0.55"
                    className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Nota <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                name="reason"
                placeholder="Factura 4521 de Distribuidora XYZ"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={pendienteMov}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pendienteMov && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar {pestana}
            </button>
          </form>
        )}

        {/* Conteo fisico */}
        {pestana === 'conteo' && (
          <form action={enviarAj} className="space-y-4">
            <input type="hidden" name="productId" value={producto.id} />

            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Ingrese la cantidad que conto en bodega. El sistema calcula la
              diferencia y registra el ajuste correspondiente en el kardex.
            </p>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Cantidad contada
              </label>
              <input
                name="cantidadContada"
                inputMode="decimal"
                placeholder={producto.stock}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Motivo del ajuste
              </label>
              <input
                name="reason"
                placeholder="Inventario mensual de septiembre"
                required
                minLength={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={pendienteAj}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pendienteAj && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar ajuste
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Pestana({
  activa, onClick, icono, children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition ${
        activa
          ? 'border-b-2 border-slate-900 text-slate-900'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {icono} {children}
    </button>
  );
}
