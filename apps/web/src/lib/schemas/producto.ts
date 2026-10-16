// ============================================================
// apps/web/src/lib/schemas/producto.ts
// ============================================================
// Un solo esquema Zod para cliente y servidor. El cliente lo usa
// para dar retroalimentacion inmediata; el Server Action lo usa
// para la validacion real. La del servidor es la que manda.
// ============================================================

import { z } from 'zod';

// Acepta "1.5", "1,5" y "" -> normaliza a string decimal.
// El separador decimal con coma es comun al teclear en El Salvador.
const decimal = (etiqueta: string, min = 0) =>
  z.string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => v === '' || !Number.isNaN(Number(v)), {
      message: `${etiqueta} debe ser un numero`,
    })
    .refine((v) => v === '' || Number(v) >= min, {
      message: `${etiqueta} no puede ser menor que ${min}`,
    });

export const esquemaProducto = z.object({
  sku: z.string()
    .trim()
    .min(1, 'El codigo interno es obligatorio')
    .max(40, 'Maximo 40 caracteres'),

  name: z.string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(160, 'Maximo 160 caracteres'),

  barcode: z.string().trim().max(64).optional().or(z.literal('')),

  description: z.string().trim().max(1000).optional().or(z.literal('')),

  categoryId: z.string().uuid('Seleccione una categoria valida')
    .optional().or(z.literal('')),

  unitCode: z.string().trim().min(1).default('UNIDAD'),

  salePrice: decimal('El precio de venta', 0)
    .refine((v) => v !== '', { message: 'El precio de venta es obligatorio' }),

  costPrice: decimal('El costo', 0).optional(),

  taxRate: decimal('El IVA', 0).optional(),

  minStock: decimal('El stock minimo', 0).optional(),

  stockInicial: decimal('El stock inicial', 0).optional(),

  trackStock: z.coerce.boolean().default(true),
  allowNegative: z.coerce.boolean().default(false),
  priceIncludesTax: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
})
// Regla de negocio: vender por debajo del costo suele ser un
// error de dedo. Se avisa, pero no se bloquea.
.refine(
  (d) => !d.costPrice || d.costPrice === '' ||
         Number(d.salePrice) >= Number(d.costPrice),
  {
    message: 'El precio de venta es menor que el costo. Verifique.',
    path: ['salePrice'],
  },
);

export type DatosProducto = z.infer<typeof esquemaProducto>;

// ------------------------------------------------------------
export const esquemaAjuste = z.object({
  productId: z.string().uuid(),
  cantidadContada: decimal('La cantidad contada', 0)
    .refine((v) => v !== '', { message: 'Ingrese la cantidad contada' }),
  reason: z.string().trim().min(3, 'Explique el motivo del ajuste').max(500),
});

export const esquemaMovimiento = z.object({
  productId: z.string().uuid(),
  movementType: z.enum([
    'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR',
    'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA',
    'TRASLADO_ENTRADA', 'TRASLADO_SALIDA',
  ]),
  quantity: decimal('La cantidad', 0)
    .refine((v) => v !== '' && Number(v) > 0, {
      message: 'La cantidad debe ser mayor que cero',
    }),
  unitCost: decimal('El costo unitario', 0).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const esquemaCategoria = z.object({
  name: z.string().trim().min(2, 'Nombre muy corto').max(80),
  sortOrder: z.coerce.number().int().optional(),
});

// ------------------------------------------------------------
// Etiquetas legibles para la interfaz
// ------------------------------------------------------------
export const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  COMPRA: 'Compra a proveedor',
  VENTA: 'Venta',
  DEVOLUCION_CLIENTE: 'Devolucion de cliente',
  DEVOLUCION_PROVEEDOR: 'Devolucion a proveedor',
  AJUSTE_POSITIVO: 'Ajuste (sobrante)',
  AJUSTE_NEGATIVO: 'Ajuste (faltante)',
  TRASLADO_ENTRADA: 'Traslado recibido',
  TRASLADO_SALIDA: 'Traslado enviado',
  MERMA: 'Merma o dano',
  INVENTARIO_INICIAL: 'Inventario inicial',
};

export const ETIQUETAS_ESTADO_STOCK: Record<string, { texto: string; clase: string }> = {
  OK:        { texto: 'Disponible', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BAJO:      { texto: 'Stock bajo', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  AGOTADO:   { texto: 'Agotado',    clase: 'bg-red-50 text-red-700 border-red-200' },
  NO_APLICA: { texto: 'Sin control',clase: 'bg-slate-50 text-slate-600 border-slate-200' },
};
