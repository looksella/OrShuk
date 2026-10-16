// ============================================================
// apps/web/src/app/(app)/productos/_componentes/formulario-producto.tsx
// ============================================================
'use client';

// Patron hibrido: React Hook Form valida en el navegador para
// dar respuesta inmediata, y el Server Action vuelve a validar
// con el MISMO esquema Zod. La del servidor es la que decide.
// ============================================================

import { useActionState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { esquemaProducto, type DatosProducto } from '@/lib/schemas/producto';
import { crearProducto, actualizarProducto } from '../actions';

type Props = {
  categorias: { id: string; name: string }[];
  unidades: { code: string; name: string; allowDecimal: boolean }[];
  producto?: Partial<DatosProducto> & { id?: string };
};

export function FormularioProducto({ categorias, unidades, producto }: Props) {
  const router = useRouter();
  const esEdicion = Boolean(producto?.id);
  const refFormulario = useRef<HTMLFormElement>(null);

  const accion = esEdicion
    ? actualizarProducto.bind(null, producto!.id!)
    : crearProducto;

  const [estado, enviar, enviando] = useActionState(accion, { ok: false });

  const {
    register, formState: { errors }, watch, trigger, setError,
  } = useForm<DatosProducto>({
    resolver: zodResolver(esquemaProducto),
    // onBlur da la mejor experiencia: el error aparece cuando el
    // usuario sale del campo, no mientras aun esta escribiendo.
    mode: 'onBlur',
    defaultValues: {
      sku: producto?.sku ?? '',
      name: producto?.name ?? '',
      barcode: producto?.barcode ?? '',
      description: producto?.description ?? '',
      categoryId: producto?.categoryId ?? '',
      unitCode: producto?.unitCode ?? 'UNIDAD',
      salePrice: producto?.salePrice ?? '',
      costPrice: producto?.costPrice ?? '',
      taxRate: producto?.taxRate ?? '0.13',
      minStock: producto?.minStock ?? '0',
      stockInicial: '',
      trackStock: producto?.trackStock ?? true,
      allowNegative: producto?.allowNegative ?? false,
      priceIncludesTax: producto?.priceIncludesTax ?? true,
      isActive: producto?.isActive ?? true,
    },
  });

  // Los errores que devuelve el servidor se inyectan en RHF
  // para que aparezcan junto al campo correspondiente.
  useEffect(() => {
    if (estado.errores) {
      Object.entries(estado.errores).forEach(([campo, mensajes]) => {
        setError(campo as keyof DatosProducto, {
          type: 'server',
          message: mensajes?.[0],
        });
      });
    }
    if (estado.ok && !esEdicion) {
      refFormulario.current?.reset();
      router.push('/productos');
    }
  }, [estado]);

  const costo = watch('costPrice');
  const venta = watch('salePrice');
  const controlaStock = watch('trackStock');
  const unidadElegida = watch('unitCode');
  const permiteDecimal = unidades.find((u) => u.code === unidadElegida)?.allowDecimal;

  const margen = (() => {
    const c = Number(costo);
    const v = Number(venta);
    if (!c || !v || c <= 0) return null;
    return { porcentaje: ((v - c) / v) * 100, ganancia: v - c };
  })();

  return (
    <form ref={refFormulario} action={enviar} className="space-y-6">
      {/* Avisos */}
      {estado.mensaje && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          estado.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {estado.ok
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{estado.mensaje}</span>
        </div>
      )}

      {/* Identificacion */}
      <Seccion titulo="Identificacion">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Codigo interno (SKU)" error={errors.sku?.message} requerido>
            <input
              {...register('sku')}
              placeholder="BEB-001"
              className={claseInput(errors.sku)}
              autoFocus
            />
          </Campo>

          <Campo etiqueta="Codigo de barras" error={errors.barcode?.message}
                 ayuda="Puede escanearlo directamente en este campo">
            <input
              {...register('barcode')}
              placeholder="7501055363057"
              className={claseInput(errors.barcode)}
              inputMode="numeric"
            />
          </Campo>
        </div>

        <Campo etiqueta="Nombre del producto" error={errors.name?.message} requerido>
          <input
            {...register('name')}
            placeholder="Coca-Cola 600ml"
            className={claseInput(errors.name)}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Categoria" error={errors.categoryId?.message}>
            <select {...register('categoryId')} className={claseInput(errors.categoryId)}>
              <option value="">Sin categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Unidad de medida" error={errors.unitCode?.message}
                 ayuda={permiteDecimal ? 'Admite cantidades con decimales' : 'Solo cantidades enteras'}>
            <select {...register('unitCode')} className={claseInput(errors.unitCode)}>
              {unidades.map((u) => (
                <option key={u.code} value={u.code}>{u.name}</option>
              ))}
            </select>
          </Campo>
        </div>
      </Seccion>

      {/* Precios */}
      <Seccion titulo="Precios">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Costo de compra" error={errors.costPrice?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                {...register('costPrice')}
                placeholder="0.55"
                inputMode="decimal"
                className={`${claseInput(errors.costPrice)} pl-7`}
              />
            </div>
          </Campo>

          <Campo etiqueta="Precio de venta" error={errors.salePrice?.message} requerido>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                {...register('salePrice')}
                placeholder="0.85"
                inputMode="decimal"
                className={`${claseInput(errors.salePrice)} pl-7`}
              />
            </div>
          </Campo>

          <Campo etiqueta="Margen" ayuda="Se calcula solo">
            <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums">
              {margen ? (
                <span className={
                  margen.porcentaje < 10 ? 'text-red-600'
                    : margen.porcentaje < 25 ? 'text-amber-600'
                    : 'text-emerald-600'
                }>
                  {margen.porcentaje.toFixed(1)}% · ${margen.ganancia.toFixed(2)}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
          </Campo>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('priceIncludesTax')}
            className="h-4 w-4 rounded border-slate-300"
          />
          El precio de venta ya incluye IVA
        </label>
      </Seccion>

      {/* Inventario */}
      <Seccion titulo="Inventario">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('trackStock')}
            className="h-4 w-4 rounded border-slate-300"
          />
          Controlar existencias de este producto
        </label>

        {controlaStock && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Stock minimo" error={errors.minStock?.message}
                   ayuda="Al llegar a este nivel se genera una alerta">
              <input
                {...register('minStock')}
                placeholder="24"
                inputMode="decimal"
                className={claseInput(errors.minStock)}
              />
            </Campo>

            {!esEdicion && (
              <Campo etiqueta="Existencia inicial" error={errors.stockInicial?.message}
                     ayuda="Cantidad con la que arranca en bodega">
                <input
                  {...register('stockInicial')}
                  placeholder="72"
                  inputMode="decimal"
                  className={claseInput(errors.stockInicial)}
                />
              </Campo>
            )}
          </div>
        )}

        {controlaStock && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              {...register('allowNegative')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Permitir vender sin existencia
              <span className="block text-xs text-slate-500">
                Util para productos que se reponen a diario, como el pan
              </span>
            </span>
          </label>
        )}
      </Seccion>

      {/* Acciones */}
      <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {enviando
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            : <><Save className="h-4 w-4" /> {esEdicion ? 'Guardar cambios' : 'Crear producto'}</>}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-slate-900">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Campo({
  etiqueta, error, ayuda, requerido, children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-xs text-red-600">{error}</p>
        : ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}

function claseInput(error?: unknown) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100'
  }`;
}
