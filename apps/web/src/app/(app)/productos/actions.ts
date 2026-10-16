// ============================================================
// apps/web/src/app/(app)/productos/actions.ts
// ============================================================
'use server';

// Un Server Action es un endpoint HTTP publico. No importa que
// el formulario solo se renderice en una pagina protegida:
// la validacion y la autorizacion se verifican AQUI, siempre.
// ============================================================

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  esquemaProducto, esquemaAjuste, esquemaMovimiento, esquemaCategoria,
} from '@/lib/schemas/producto';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';

type EstadoAccion = {
  ok: boolean;
  mensaje?: string;
  errores?: Record<string, string[]>;
  datos?: unknown;
};

// ------------------------------------------------------------
// Helper de peticion autenticada
// ------------------------------------------------------------
async function peticion(ruta: string, opciones: RequestInit = {}) {
  const almacen = await cookies();
  const token = almacen.get('orshuk_access')?.value;

  if (!token) {
    return { ok: false, estado: 401, datos: { message: 'Sesion expirada' } };
  }

  try {
    const r = await fetch(`${API}/api${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opciones.headers ?? {}),
      },
      cache: 'no-store',
    });

    const datos = await r.json().catch(() => ({}));
    return { ok: r.ok, estado: r.status, datos };
  } catch {
    return {
      ok: false,
      estado: 503,
      datos: { message: 'No se pudo conectar con el servidor.' },
    };
  }
}

// ------------------------------------------------------------
// Crear producto
// ------------------------------------------------------------
export async function crearProducto(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const crudo = Object.fromEntries(formData.entries());
  const parseado = esquemaProducto.safeParse({
    ...crudo,
    trackStock: crudo.trackStock === 'on' || crudo.trackStock === 'true',
    allowNegative: crudo.allowNegative === 'on' || crudo.allowNegative === 'true',
    priceIncludesTax: crudo.priceIncludesTax !== 'false',
    isActive: crudo.isActive !== 'false',
  });

  if (!parseado.success) {
    return {
      ok: false,
      mensaje: 'Revise los campos marcados.',
      errores: parseado.error.flatten().fieldErrors,
    };
  }

  const d = parseado.data;
  const cuerpo = {
    sku: d.sku,
    name: d.name,
    barcode: d.barcode || undefined,
    description: d.description || undefined,
    categoryId: d.categoryId || undefined,
    unitCode: d.unitCode,
    salePrice: d.salePrice,
    costPrice: d.costPrice || '0',
    taxRate: d.taxRate || '0.13',
    minStock: d.minStock || '0',
    stockInicial: d.stockInicial || undefined,
    trackStock: d.trackStock,
    allowNegative: d.allowNegative,
    priceIncludesTax: d.priceIncludesTax,
    isActive: d.isActive,
  };

  const r = await peticion('/productos', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });

  if (!r.ok) {
    return {
      ok: false,
      mensaje: (r.datos as any)?.message ?? 'No se pudo crear el producto.',
    };
  }

  revalidatePath('/productos');
  return { ok: true, mensaje: `Producto "${d.name}" creado.`, datos: r.datos };
}

// ------------------------------------------------------------
// Actualizar producto
// ------------------------------------------------------------
export async function actualizarProducto(
  id: string,
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const crudo = Object.fromEntries(formData.entries());
  const parseado = esquemaProducto.partial().safeParse({
    ...crudo,
    trackStock: crudo.trackStock === 'on' || crudo.trackStock === 'true',
    allowNegative: crudo.allowNegative === 'on' || crudo.allowNegative === 'true',
  });

  if (!parseado.success) {
    return {
      ok: false,
      mensaje: 'Revise los campos marcados.',
      errores: parseado.error.flatten().fieldErrors,
    };
  }

  const r = await peticion(`/productos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parseado.data),
  });

  if (!r.ok) {
    return { ok: false, mensaje: (r.datos as any)?.message ?? 'No se pudo actualizar.' };
  }

  revalidatePath('/productos');
  revalidatePath(`/productos/${id}`);
  return { ok: true, mensaje: 'Cambios guardados.' };
}

// ------------------------------------------------------------
// Desactivar / reactivar
// ------------------------------------------------------------
export async function desactivarProducto(id: string): Promise<EstadoAccion> {
  const r = await peticion(`/productos/${id}`, { method: 'DELETE' });
  if (!r.ok) {
    return { ok: false, mensaje: (r.datos as any)?.message ?? 'No se pudo desactivar.' };
  }
  revalidatePath('/productos');
  return { ok: true, mensaje: (r.datos as any)?.mensaje ?? 'Producto desactivado.' };
}

export async function reactivarProducto(id: string): Promise<EstadoAccion> {
  const r = await peticion(`/productos/${id}/reactivar`, { method: 'POST' });
  if (!r.ok) {
    return { ok: false, mensaje: (r.datos as any)?.message ?? 'No se pudo reactivar.' };
  }
  revalidatePath('/productos');
  return { ok: true, mensaje: 'Producto reactivado.' };
}

// ------------------------------------------------------------
// Movimiento de inventario
// ------------------------------------------------------------
export async function registrarMovimiento(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const parseado = esquemaMovimiento.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parseado.success) {
    return {
      ok: false,
      mensaje: 'Revise los datos del movimiento.',
      errores: parseado.error.flatten().fieldErrors,
    };
  }

  const r = await peticion('/productos/movimientos', {
    method: 'POST',
    body: JSON.stringify(parseado.data),
  });

  if (!r.ok) {
    return {
      ok: false,
      mensaje: (r.datos as any)?.message ?? 'No se pudo registrar el movimiento.',
    };
  }

  revalidatePath('/productos');
  revalidatePath(`/productos/${parseado.data.productId}`);
  return {
    ok: true,
    mensaje: `Movimiento registrado. Nuevo saldo: ${(r.datos as any)?.saldoNuevo}`,
    datos: r.datos,
  };
}

// ------------------------------------------------------------
// Ajuste por conteo fisico
// ------------------------------------------------------------
export async function ajustarInventario(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const parseado = esquemaAjuste.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parseado.success) {
    return {
      ok: false,
      mensaje: 'Revise los datos del ajuste.',
      errores: parseado.error.flatten().fieldErrors,
    };
  }

  const r = await peticion('/productos/ajustes', {
    method: 'POST',
    body: JSON.stringify(parseado.data),
  });

  if (!r.ok) {
    return { ok: false, mensaje: (r.datos as any)?.message ?? 'No se pudo ajustar.' };
  }

  revalidatePath('/productos');
  revalidatePath(`/productos/${parseado.data.productId}`);
  return {
    ok: true,
    mensaje: (r.datos as any)?.mensaje ?? 'Inventario ajustado.',
    datos: r.datos,
  };
}

// ------------------------------------------------------------
// Crear categoria
// ------------------------------------------------------------
export async function crearCategoria(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const parseado = esquemaCategoria.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parseado.success) {
    return {
      ok: false,
      errores: parseado.error.flatten().fieldErrors,
    };
  }

  const r = await peticion('/productos/categorias', {
    method: 'POST',
    body: JSON.stringify(parseado.data),
  });

  if (!r.ok) {
    return { ok: false, mensaje: (r.datos as any)?.message ?? 'No se pudo crear.' };
  }

  revalidatePath('/productos');
  return { ok: true, mensaje: `Categoria "${parseado.data.name}" creada.` };
}

// ------------------------------------------------------------
// Lecturas para Server Components
// ------------------------------------------------------------
export async function obtenerProductos(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await peticion(`/productos${qs ? `?${qs}` : ''}`);
  return r.ok
    ? (r.datos as any)
    : { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
}

export async function obtenerProducto(id: string) {
  const r = await peticion(`/productos/${id}`);
  return r.ok ? r.datos : null;
}

export async function obtenerCategorias() {
  const r = await peticion('/productos/categorias');
  return r.ok ? (r.datos as any[]) : [];
}

export async function obtenerUnidades() {
  const r = await peticion('/productos/unidades');
  return r.ok ? (r.datos as any[]) : [];
}

export async function obtenerResumen() {
  const r = await peticion('/productos/resumen');
  return r.ok ? (r.datos as any) : null;
}

export async function obtenerStockBajo() {
  const r = await peticion('/productos/stock-bajo');
  return r.ok ? (r.datos as any[]) : [];
}

export async function obtenerHistorial(id: string, page = 1) {
  const r = await peticion(`/productos/${id}/historial?page=${page}`);
  return r.ok ? (r.datos as any) : { items: [], total: 0 };
}

// Busqueda para el POS: se llama desde el cliente con debounce
export async function buscarProductos(termino: string) {
  if (!termino.trim()) return [];
  const r = await peticion(`/productos/buscar?q=${encodeURIComponent(termino)}`);
  return r.ok ? (r.datos as any[]) : [];
}
