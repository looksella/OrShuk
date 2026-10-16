// ============================================================
// apps/api/src/modules/productos/productos.service.ts
// ============================================================
// Regla de oro del multi-tenant: TODA consulta filtra por
// tenantId. No hay excepciones. El tenantId nunca viene del
// cuerpo de la peticion, siempre del token JWT ya validado.
// ============================================================

import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject, Logger,
} from '@nestjs/common';
import { and, eq, ilike, or, sql, asc, desc, count, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import {
  CrearProductoDto, ActualizarProductoDto, ListarProductosDto,
  MovimientoStockDto, AjusteInventarioDto,
} from './dto/productos.dto';

const { products, categories, stockBalances, stockMovements, units } = schema;

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ----------------------------------------------------------
  // Listado con busqueda, filtros y paginacion
  // ----------------------------------------------------------
  async listar(tenantId: string, branchId: string, dto: ListarProductosDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const condiciones = [eq(products.tenantId, tenantId)];

    if (dto.estado === 'activos')   condiciones.push(eq(products.isActive, true));
    if (dto.estado === 'inactivos') condiciones.push(eq(products.isActive, false));

    if (dto.categoryId) {
      condiciones.push(eq(products.categoryId, dto.categoryId));
    }

    // Busqueda por nombre, SKU o codigo de barras.
    // El indice GIN trigram hace que el ILIKE con comodin
    // inicial siga usando indice en lugar de escanear la tabla.
    if (dto.q?.trim()) {
      const termino = `%${dto.q.trim()}%`;
      condiciones.push(
        or(
          ilike(products.name, termino),
          ilike(products.sku, termino),
          ilike(products.barcode, termino),
        )!,
      );
    }

    const where = and(...condiciones);

    const columnaOrden = {
      name: products.name,
      sku: products.sku,
      salePrice: products.salePrice,
      createdAt: products.createdAt,
      stock: stockBalances.quantity,
    }[dto.orderBy ?? 'name'] ?? products.name;

    const direccion = dto.order === 'desc' ? desc : asc;

    // Las dos consultas van en paralelo: el conteo total no
    // depende de la pagina, asi que no hay razon para serializar.
    const [filas, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: products.id,
          sku: products.sku,
          barcode: products.barcode,
          name: products.name,
          categoryId: products.categoryId,
          categoria: categories.name,
          unitCode: products.unitCode,
          permiteDecimal: units.allowDecimal,
          costPrice: products.costPrice,
          salePrice: products.salePrice,
          taxRate: products.taxRate,
          minStock: products.minStock,
          trackStock: products.trackStock,
          isActive: products.isActive,
          stock: sql<string>`COALESCE(${stockBalances.quantity}, '0')`.as('stock'),
          estadoStock: sql<string>`
            CASE
              WHEN NOT ${products.trackStock} THEN 'NO_APLICA'
              WHEN COALESCE(${stockBalances.quantity}, 0) <= 0 THEN 'AGOTADO'
              WHEN COALESCE(${stockBalances.quantity}, 0) <= ${products.minStock} THEN 'BAJO'
              ELSE 'OK'
            END`.as('estado_stock'),
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(units, eq(units.code, products.unitCode))
        .leftJoin(
          stockBalances,
          and(
            eq(stockBalances.productId, products.id),
            eq(stockBalances.branchId, branchId),
          ),
        )
        .where(where)
        // Ordenar tambien por id garantiza paginacion estable:
        // sin un desempate unico, dos filas con el mismo nombre
        // pueden alternar de pagina entre peticiones.
        .orderBy(direccion(columnaOrden), asc(products.id))
        .limit(pageSize)
        .offset(offset),

      this.db.select({ total: count() }).from(products).where(where),
    ]);

    const items = dto.stock && dto.stock !== 'todos'
      ? filas.filter((f) => f.estadoStock === dto.stock!.toUpperCase())
      : filas;

    return {
      items,
      total: Number(total),
      page,
      pageSize,
      totalPages: Math.ceil(Number(total) / pageSize),
    };
  }

  // ----------------------------------------------------------
  // Busqueda rapida para el POS
  // ----------------------------------------------------------
  // Optimizada para el flujo del cajero: primero intenta match
  // exacto de codigo de barras (el caso del escaner), y solo si
  // falla hace la busqueda difusa por nombre.
  async busquedaRapida(tenantId: string, branchId: string, termino: string) {
    const limpio = termino.trim();
    if (!limpio) return [];

    // Camino rapido: el escaner mando un codigo de barras completo
    const exacto = await this.db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        unitCode: products.unitCode,
        permiteDecimal: units.allowDecimal,
        salePrice: products.salePrice,
        taxRate: products.taxRate,
        trackStock: products.trackStock,
        stock: sql<string>`COALESCE(${stockBalances.quantity}, '0')`,
      })
      .from(products)
      .leftJoin(units, eq(units.code, products.unitCode))
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.productId, products.id), eq(stockBalances.branchId, branchId)),
      )
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          or(eq(products.barcode, limpio), eq(products.sku, limpio)),
        ),
      )
      .limit(1);

    if (exacto.length > 0) return exacto;

    // Camino difuso: busqueda por nombre parcial
    return this.db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        unitCode: products.unitCode,
        permiteDecimal: units.allowDecimal,
        salePrice: products.salePrice,
        taxRate: products.taxRate,
        trackStock: products.trackStock,
        stock: sql<string>`COALESCE(${stockBalances.quantity}, '0')`,
      })
      .from(products)
      .leftJoin(units, eq(units.code, products.unitCode))
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.productId, products.id), eq(stockBalances.branchId, branchId)),
      )
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          ilike(products.name, `%${limpio}%`),
        ),
      )
      .orderBy(asc(products.name))
      .limit(12);
  }

  // ----------------------------------------------------------
  // Obtener uno
  // ----------------------------------------------------------
  async obtener(tenantId: string, branchId: string, id: string) {
    const [fila] = await this.db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        description: products.description,
        categoryId: products.categoryId,
        categoria: categories.name,
        unitCode: products.unitCode,
        costPrice: products.costPrice,
        salePrice: products.salePrice,
        taxRate: products.taxRate,
        priceIncludesTax: products.priceIncludesTax,
        trackStock: products.trackStock,
        minStock: products.minStock,
        allowNegative: products.allowNegative,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        stock: sql<string>`COALESCE(${stockBalances.quantity}, '0')`,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.productId, products.id), eq(stockBalances.branchId, branchId)),
      )
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .limit(1);

    if (!fila) throw new NotFoundException('Producto no encontrado');
    return fila;
  }

  // ----------------------------------------------------------
  // Crear
  // ----------------------------------------------------------
  async crear(tenantId: string, branchId: string, userId: string, dto: CrearProductoDto) {
    await this.validarSkuUnico(tenantId, dto.sku);
    if (dto.barcode) await this.validarBarcodeUnico(tenantId, dto.barcode);

    if (dto.categoryId) {
      await this.validarCategoria(tenantId, dto.categoryId);
    }

    // Transaccion: el producto y su inventario inicial son una
    // sola unidad. Si falla el stock, no queda producto huerfano.
    return this.db.transaction(async (tx) => {
      const [creado] = await tx
        .insert(products)
        .values({
          tenantId,
          categoryId: dto.categoryId ?? null,
          sku: dto.sku.trim(),
          barcode: dto.barcode?.trim() || null,
          name: dto.name.trim(),
          description: dto.description ?? null,
          unitCode: dto.unitCode ?? 'UNIDAD',
          costPrice: dto.costPrice ?? '0',
          salePrice: dto.salePrice,
          taxRate: dto.taxRate ?? '0.13',
          priceIncludesTax: dto.priceIncludesTax ?? true,
          trackStock: dto.trackStock ?? true,
          minStock: dto.minStock ?? '0',
          allowNegative: dto.allowNegative ?? false,
          isActive: dto.isActive ?? true,
        })
        .returning();

      const inicial = Number(dto.stockInicial ?? '0');
      if (inicial > 0 && creado.trackStock) {
        await tx.execute(sql`
          SELECT fn_mover_stock(
            ${tenantId}::uuid, ${branchId}::uuid, ${creado.id}::uuid,
            'INVENTARIO_INICIAL', ${dto.stockInicial}::numeric,
            ${dto.costPrice ?? '0'}::numeric, 'ALTA_PRODUCTO', NULL,
            'Stock inicial al crear el producto', ${userId}::uuid
          )
        `);
      }

      this.logger.log(`Producto creado: ${creado.sku} (tenant ${tenantId})`);
      return creado;
    });
  }

  // ----------------------------------------------------------
  // Actualizar
  // ----------------------------------------------------------
  async actualizar(tenantId: string, id: string, dto: ActualizarProductoDto) {
    await this.obtenerCrudo(tenantId, id);

    if (dto.sku)     await this.validarSkuUnico(tenantId, dto.sku, id);
    if (dto.barcode) await this.validarBarcodeUnico(tenantId, dto.barcode, id);
    if (dto.categoryId) await this.validarCategoria(tenantId, dto.categoryId);

    const cambios: Record<string, unknown> = {};
    if (dto.sku !== undefined)              cambios.sku = dto.sku.trim();
    if (dto.name !== undefined)             cambios.name = dto.name.trim();
    if (dto.barcode !== undefined)          cambios.barcode = dto.barcode?.trim() || null;
    if (dto.description !== undefined)      cambios.description = dto.description;
    if (dto.categoryId !== undefined)       cambios.categoryId = dto.categoryId || null;
    if (dto.unitCode !== undefined)         cambios.unitCode = dto.unitCode;
    if (dto.costPrice !== undefined)        cambios.costPrice = dto.costPrice;
    if (dto.salePrice !== undefined)        cambios.salePrice = dto.salePrice;
    if (dto.taxRate !== undefined)          cambios.taxRate = dto.taxRate;
    if (dto.priceIncludesTax !== undefined) cambios.priceIncludesTax = dto.priceIncludesTax;
    if (dto.trackStock !== undefined)       cambios.trackStock = dto.trackStock;
    if (dto.minStock !== undefined)         cambios.minStock = dto.minStock;
    if (dto.allowNegative !== undefined)    cambios.allowNegative = dto.allowNegative;
    if (dto.isActive !== undefined)         cambios.isActive = dto.isActive;

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No hay cambios que aplicar');
    }

    const [actualizado] = await this.db
      .update(products)
      .set(cambios)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning();

    return actualizado;
  }

  // ----------------------------------------------------------
  // Desactivar (nunca borrar)
  // ----------------------------------------------------------
  // Un producto con movimientos historicos no se puede borrar
  // sin romper la trazabilidad del inventario. Se desactiva.
  async desactivar(tenantId: string, id: string) {
    await this.obtenerCrudo(tenantId, id);

    const [{ movimientos }] = await this.db
      .select({ movimientos: count() })
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, id), eq(stockMovements.tenantId, tenantId)));

    const [resultado] = await this.db
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning({ id: products.id, name: products.name });

    return {
      ...resultado,
      mensaje: Number(movimientos) > 0
        ? 'Producto desactivado. Se conserva su historial de inventario.'
        : 'Producto desactivado.',
    };
  }

  async reactivar(tenantId: string, id: string) {
    await this.obtenerCrudo(tenantId, id);
    const [r] = await this.db
      .update(products)
      .set({ isActive: true })
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning({ id: products.id, name: products.name });
    return r;
  }

  // ----------------------------------------------------------
  // Movimiento de inventario
  // ----------------------------------------------------------
  async moverStock(
    tenantId: string, branchId: string, userId: string, dto: MovimientoStockDto,
  ) {
    await this.obtenerCrudo(tenantId, dto.productId);

    // Los tipos de salida llevan signo negativo. Esta tabla
    // evita que el frontend tenga que saber la convencion.
    const salidas = [
      'VENTA', 'DEVOLUCION_PROVEEDOR', 'AJUSTE_NEGATIVO',
      'TRASLADO_SALIDA', 'MERMA',
    ];
    const magnitud = Math.abs(Number(dto.quantity));
    if (magnitud === 0) {
      throw new BadRequestException('La cantidad no puede ser cero');
    }

    const delta = salidas.includes(dto.movementType) ? -magnitud : magnitud;

    try {
      const resultado = await this.db.execute(sql`
        SELECT fn_mover_stock(
          ${tenantId}::uuid, ${branchId}::uuid, ${dto.productId}::uuid,
          ${dto.movementType}, ${String(delta)}::numeric,
          ${dto.unitCost ?? null}::numeric, 'MANUAL', NULL,
          ${dto.reason ?? null}, ${userId}::uuid
        ) AS saldo
      `);

      const saldo = (resultado.rows?.[0] as { saldo: string })?.saldo;
      return { productId: dto.productId, movimiento: delta, saldoNuevo: saldo };
    } catch (e: any) {
      // La funcion SQL lanza mensajes pensados para el usuario final
      if (e?.cause?.message?.includes('Stock insuficiente')) {
        throw new ConflictException(e.cause.message);
      }
      throw e;
    }
  }

  // ----------------------------------------------------------
  // Ajuste por conteo fisico
  // ----------------------------------------------------------
  // El usuario reporta lo que conto; el sistema calcula la
  // diferencia y registra el movimiento compensatorio. Nunca
  // se edita el saldo directamente.
  async ajustarPorConteo(
    tenantId: string, branchId: string, userId: string, dto: AjusteInventarioDto,
  ) {
    await this.obtenerCrudo(tenantId, dto.productId);

    const [saldo] = await this.db
      .select({ quantity: stockBalances.quantity })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.productId, dto.productId),
          eq(stockBalances.branchId, branchId),
        ),
      )
      .limit(1);

    const actual = Number(saldo?.quantity ?? 0);
    const contado = Number(dto.cantidadContada);
    const diferencia = contado - actual;

    if (diferencia === 0) {
      return {
        productId: dto.productId,
        mensaje: 'El conteo coincide con el sistema. No se registro ajuste.',
        saldoNuevo: String(actual),
      };
    }

    const tipo = diferencia > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';

    const resultado = await this.db.execute(sql`
      SELECT fn_mover_stock(
        ${tenantId}::uuid, ${branchId}::uuid, ${dto.productId}::uuid,
        ${tipo}, ${String(diferencia)}::numeric, NULL,
        'CONTEO_FISICO', NULL,
        ${`Conteo fisico: sistema ${actual}, contado ${contado}. ${dto.reason}`},
        ${userId}::uuid
      ) AS saldo
    `);

    return {
      productId: dto.productId,
      saldoAnterior: String(actual),
      saldoNuevo: (resultado.rows?.[0] as { saldo: string })?.saldo,
      diferencia: String(diferencia),
      tipo,
    };
  }

  // ----------------------------------------------------------
  // Historial (kardex)
  // ----------------------------------------------------------
  async historial(
    tenantId: string, branchId: string, productId: string,
    page = 1, pageSize = 50,
  ) {
    await this.obtenerCrudo(tenantId, productId);
    const offset = (page - 1) * pageSize;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: stockMovements.id,
          movementType: stockMovements.movementType,
          quantityDelta: stockMovements.quantityDelta,
          balanceAfter: stockMovements.balanceAfter,
          unitCost: stockMovements.unitCost,
          referenceType: stockMovements.referenceType,
          reason: stockMovements.reason,
          occurredAt: stockMovements.occurredAt,
          usuario: schema.users.fullName,
        })
        .from(stockMovements)
        .leftJoin(schema.users, eq(schema.users.id, stockMovements.userId))
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.branchId, branchId),
            eq(stockMovements.productId, productId),
          ),
        )
        .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id))
        .limit(pageSize)
        .offset(offset),

      this.db
        .select({ total: count() })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.branchId, branchId),
            eq(stockMovements.productId, productId),
          ),
        ),
    ]);

    return { items, total: Number(total), page, pageSize };
  }

  // ----------------------------------------------------------
  // Alertas de stock bajo
  // ----------------------------------------------------------
  async stockBajo(tenantId: string, branchId: string) {
    return this.db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        unitCode: products.unitCode,
        minStock: products.minStock,
        stock: sql<string>`COALESCE(${stockBalances.quantity}, '0')`,
        faltante: sql<string>`
          (${products.minStock} - COALESCE(${stockBalances.quantity}, 0))`,
      })
      .from(products)
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.productId, products.id), eq(stockBalances.branchId, branchId)),
      )
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          eq(products.trackStock, true),
          sql`COALESCE(${stockBalances.quantity}, 0) <= ${products.minStock}`,
        ),
      )
      .orderBy(asc(products.name));
  }

  // ----------------------------------------------------------
  // Resumen para el dashboard
  // ----------------------------------------------------------
  async resumen(tenantId: string, branchId: string) {
    const [fila] = await this.db
      .select({
        totalProductos: count(products.id),
        valorCosto: sql<string>`
          COALESCE(SUM(COALESCE(${stockBalances.quantity},0) * ${products.costPrice}), 0)::numeric(14,2)`,
        valorVenta: sql<string>`
          COALESCE(SUM(COALESCE(${stockBalances.quantity},0) * ${products.salePrice}), 0)::numeric(14,2)`,
        agotados: sql<number>`
          COUNT(*) FILTER (WHERE ${products.trackStock} AND COALESCE(${stockBalances.quantity},0) <= 0)`,
        bajos: sql<number>`
          COUNT(*) FILTER (WHERE ${products.trackStock}
            AND COALESCE(${stockBalances.quantity},0) > 0
            AND COALESCE(${stockBalances.quantity},0) <= ${products.minStock})`,
      })
      .from(products)
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.productId, products.id), eq(stockBalances.branchId, branchId)),
      )
      .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));

    return fila;
  }

  // ----------------------------------------------------------
  // Categorias
  // ----------------------------------------------------------
  async listarCategorias(tenantId: string) {
    return this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        sortOrder: categories.sortOrder,
        productos: count(products.id),
      })
      .from(categories)
      .leftJoin(
        products,
        and(eq(products.categoryId, categories.id), eq(products.isActive, true)),
      )
      .where(and(eq(categories.tenantId, tenantId), eq(categories.isActive, true)))
      .groupBy(categories.id)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async crearCategoria(tenantId: string, name: string, sortOrder = 0) {
    const slug = name.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existe = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, slug)))
      .limit(1);

    if (existe.length > 0) {
      throw new ConflictException(`Ya existe una categoria llamada "${name}"`);
    }

    const [creada] = await this.db
      .insert(categories)
      .values({ tenantId, name: name.trim(), slug, sortOrder })
      .returning();

    return creada;
  }

  async listarUnidades() {
    return this.db.select().from(units).orderBy(asc(units.name));
  }

  // ----------------------------------------------------------
  // Helpers privados
  // ----------------------------------------------------------
  private async obtenerCrudo(tenantId: string, id: string) {
    const [p] = await this.db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .limit(1);
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  private async validarSkuUnico(tenantId: string, sku: string, excluirId?: string) {
    const cond = [eq(products.tenantId, tenantId), eq(products.sku, sku.trim())];
    if (excluirId) cond.push(ne(products.id, excluirId));

    const [existe] = await this.db
      .select({ id: products.id })
      .from(products).where(and(...cond)).limit(1);

    if (existe) throw new ConflictException(`El SKU "${sku}" ya esta en uso`);
  }

  private async validarBarcodeUnico(tenantId: string, barcode: string, excluirId?: string) {
    const cond = [eq(products.tenantId, tenantId), eq(products.barcode, barcode.trim())];
    if (excluirId) cond.push(ne(products.id, excluirId));

    const [existe] = await this.db
      .select({ id: products.id, name: products.name })
      .from(products).where(and(...cond)).limit(1);

    if (existe) {
      throw new ConflictException(
        `El codigo de barras "${barcode}" ya pertenece a "${existe.name}"`,
      );
    }
  }

  private async validarCategoria(tenantId: string, categoryId: string) {
    const [c] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
      .limit(1);
    if (!c) throw new BadRequestException('La categoria no existe en esta empresa');
  }
}
