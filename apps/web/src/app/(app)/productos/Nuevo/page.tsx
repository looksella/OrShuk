import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { obtenerCategorias, obtenerUnidades } from '../actions';
import { FormularioProducto } from '../_componentes/formulario-producto';

export const metadata = { title: 'Nuevo producto · OrShuk' };

export default async function PaginaNuevoProducto() {
  const [categorias, unidades] = await Promise.all([
    obtenerCategorias(),
    obtenerUnidades(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/productos"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al catalogo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Nuevo producto
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete los datos. Solo el codigo, el nombre y el precio de venta son obligatorios.
        </p>
      </div>

      <FormularioProducto categorias={categorias} unidades={unidades} />
    </div>
  );
}
