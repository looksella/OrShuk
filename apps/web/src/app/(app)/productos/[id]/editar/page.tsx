import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { obtenerProducto, obtenerCategorias, obtenerUnidades } from '../../actions';
import { FormularioProducto } from '../../_componentes/formulario-producto';

export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [producto, categorias, unidades] = await Promise.all([
    obtenerProducto(id),
    obtenerCategorias(),
    obtenerUnidades(),
  ]);

  if (!producto) notFound();
  const p = producto as any;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/productos/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Editar producto
        </h1>
      </div>

      <FormularioProducto
        categorias={categorias}
        unidades={unidades}
        producto={{
          id: p.id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode ?? '',
          description: p.description ?? '',
          categoryId: p.categoryId ?? '',
          unitCode: p.unitCode,
          salePrice: p.salePrice,
          costPrice: p.costPrice,
          taxRate: p.taxRate,
          minStock: p.minStock,
          trackStock: p.trackStock,
          allowNegative: p.allowNegative,
          priceIncludesTax: p.priceIncludesTax,
          isActive: p.isActive,
        }}
      />
    </div>
  );
}
*/
