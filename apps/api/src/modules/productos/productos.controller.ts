// ============================================================
// apps/api/src/modules/productos/productos.controller.ts
// ============================================================
// El tenantId y branchId NUNCA se leen del body ni del query.
// Vienen del token JWT que el JwtAuthGuard ya valido. Si los
// aceptaramos del cliente, cualquiera podria leer datos de otra
// empresa cambiando un parametro.
// ============================================================

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { PayloadUsuario } from '../auth/types';
import {
  CrearProductoDto, ActualizarProductoDto, ListarProductosDto,
  MovimientoStockDto, AjusteInventarioDto, CrearCategoriaDto,
} from './dto/productos.dto';

@Controller('productos')
export class ProductosController {
  constructor(private readonly servicio: ProductosService) {}

  // ---------- Lectura ----------

  @Get()
  listar(@UsuarioActual() u: PayloadUsuario, @Query() dto: ListarProductosDto) {
    return this.servicio.listar(u.tenantId, u.branchId, dto);
  }

  // Endpoint dedicado al POS: responde rapido y con el minimo
  // de campos que la pantalla de venta necesita.
  @Get('buscar')
  buscar(@UsuarioActual() u: PayloadUsuario, @Query('q') q: string) {
    return this.servicio.busquedaRapida(u.tenantId, u.branchId, q ?? '');
  }

  @Get('resumen')
  resumen(@UsuarioActual() u: PayloadUsuario) {
    return this.servicio.resumen(u.tenantId, u.branchId);
  }

  @Get('stock-bajo')
  stockBajo(@UsuarioActual() u: PayloadUsuario) {
    return this.servicio.stockBajo(u.tenantId, u.branchId);
  }

  @Get('categorias')
  categorias(@UsuarioActual() u: PayloadUsuario) {
    return this.servicio.listarCategorias(u.tenantId);
  }

  @Get('unidades')
  unidades() {
    return this.servicio.listarUnidades();
  }

  @Get(':id')
  obtener(
    @UsuarioActual() u: PayloadUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicio.obtener(u.tenantId, u.branchId, id);
  }

  @Get(':id/historial')
  historial(
    @UsuarioActual() u: PayloadUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.servicio.historial(
      u.tenantId, u.branchId, id, Number(page), Number(pageSize),
    );
  }

  // ---------- Escritura ----------

  @Post()
  @Roles('PROPIETARIO', 'ADMIN')
  crear(@UsuarioActual() u: PayloadUsuario, @Body() dto: CrearProductoDto) {
    return this.servicio.crear(u.tenantId, u.branchId, u.sub, dto);
  }

  @Patch(':id')
  @Roles('PROPIETARIO', 'ADMIN')
  actualizar(
    @UsuarioActual() u: PayloadUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.servicio.actualizar(u.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('PROPIETARIO', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  desactivar(
    @UsuarioActual() u: PayloadUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicio.desactivar(u.tenantId, id);
  }

  @Post(':id/reactivar')
  @Roles('PROPIETARIO', 'ADMIN')
  reactivar(
    @UsuarioActual() u: PayloadUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicio.reactivar(u.tenantId, id);
  }

  @Post('categorias')
  @Roles('PROPIETARIO', 'ADMIN')
  crearCategoria(
    @UsuarioActual() u: PayloadUsuario,
    @Body() dto: CrearCategoriaDto,
  ) {
    return this.servicio.crearCategoria(u.tenantId, dto.name, dto.sortOrder ?? 0);
  }

  // ---------- Inventario ----------

  @Post('movimientos')
  @Roles('PROPIETARIO', 'ADMIN', 'BODEGUERO')
  moverStock(@UsuarioActual() u: PayloadUsuario, @Body() dto: MovimientoStockDto) {
    return this.servicio.moverStock(u.tenantId, u.branchId, u.sub, dto);
  }

  @Post('ajustes')
  @Roles('PROPIETARIO', 'ADMIN', 'BODEGUERO')
  ajustar(@UsuarioActual() u: PayloadUsuario, @Body() dto: AjusteInventarioDto) {
    return this.servicio.ajustarPorConteo(u.tenantId, u.branchId, u.sub, dto);
  }
}
