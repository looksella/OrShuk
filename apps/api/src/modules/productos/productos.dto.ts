// ============================================================
// apps/api/src/modules/productos/dto/productos.dto.ts
// ============================================================
// Los DTO son la frontera de confianza de la API. Todo lo que
// entra se valida aqui antes de tocar la base de datos.
// ============================================================

import {
  IsString, IsOptional, IsBoolean, IsUUID, IsInt, IsIn,
  MinLength, MaxLength, Min, Max, IsNumberString, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { MOVEMENT_TYPES } from '../../../database/schema/productos.schema';

// ------------------------------------------------------------
// Crear producto
// ------------------------------------------------------------
export class CrearProductoDto {
  @IsString()
  @MinLength(1, { message: 'El SKU es obligatorio' })
  @MaxLength(40)
  sku: string;

  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(160)
  name: string;

  @IsOptional() @IsString() @MaxLength(64)
  barcode?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsString() @MaxLength(12)
  unitCode?: string;

  // Los montos viajan como string para no perder precision
  // en el trayecto JSON -> NUMERIC de Postgres.
  @IsNumberString({}, { message: 'El precio de venta debe ser numerico' })
  salePrice: string;

  @IsOptional() @IsNumberString()
  costPrice?: string;

  @IsOptional() @IsNumberString()
  taxRate?: string;

  @IsOptional() @IsBoolean()
  priceIncludesTax?: boolean;

  @IsOptional() @IsBoolean()
  trackStock?: boolean;

  @IsOptional() @IsNumberString()
  minStock?: string;

  @IsOptional() @IsBoolean()
  allowNegative?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  // Cantidad inicial opcional: si viene, se registra un
  // movimiento de INVENTARIO_INICIAL en la misma operacion.
  @IsOptional() @IsNumberString()
  stockInicial?: string;
}

// ------------------------------------------------------------
// Actualizar producto
// ------------------------------------------------------------
// PartialType vuelve opcionales todos los campos del DTO base
// sin duplicar las reglas de validacion.
export class ActualizarProductoDto extends PartialType(CrearProductoDto) {}

// ------------------------------------------------------------
// Listar productos
// ------------------------------------------------------------
export class ListarProductosDto {
  @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;

  @IsOptional() @IsIn(['name', 'sku', 'salePrice', 'createdAt', 'stock'])
  orderBy?: string = 'name';

  @IsOptional() @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  @IsOptional() @IsIn(['todos', 'activos', 'inactivos'])
  estado?: string = 'activos';

  @IsOptional() @IsIn(['todos', 'ok', 'bajo', 'agotado'])
  stock?: string = 'todos';
}

// ------------------------------------------------------------
// Categorias
// ------------------------------------------------------------
export class CrearCategoriaDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name: string;

  @IsOptional() @IsString() @MaxLength(80)
  slug?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  sortOrder?: number;
}

export class ActualizarCategoriaDto extends PartialType(CrearCategoriaDto) {}

// ------------------------------------------------------------
// Movimientos de inventario
// ------------------------------------------------------------
export class MovimientoStockDto {
  @IsUUID()
  productId: string;

  @IsIn(MOVEMENT_TYPES as unknown as string[], {
    message: 'Tipo de movimiento no valido',
  })
  movementType: string;

  @IsNumberString({}, { message: 'La cantidad debe ser numerica' })
  quantity: string;

  @IsOptional() @IsNumberString()
  unitCost?: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class AjusteInventarioDto {
  @IsUUID()
  productId: string;

  // Cantidad contada fisicamente. El sistema calcula la
  // diferencia y registra el movimiento compensatorio.
  @IsNumberString()
  cantidadContada: string;

  @IsString() @MinLength(3, { message: 'Indique el motivo del ajuste' }) @MaxLength(500)
  reason: string;
}

export class BusquedaRapidaDto {
  @IsString() @MinLength(1) @MaxLength(64)
  termino: string;
}
