// ============================================================
// apps/api/src/modules/productos/productos.module.ts
// ============================================================

import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductosController],
  providers: [ProductosService],
  // Se exporta porque el modulo de ventas (Semana 4) va a
  // necesitar consultar precios y descontar stock.
  exports: [ProductosService],
})
export class ProductosModule {}

// ------------------------------------------------------------
// RECORDATORIO: registrar en apps/api/src/app.module.ts
// ------------------------------------------------------------
//
//   import { ProductosModule } from './modules/productos/productos.module';
//
//   @Module({
//     imports: [
//       ConfigModule.forRoot({ ... }),
//       DatabaseModule,
//       AuthModule,
//       UsersModule,
//       ProductosModule,   // <-- agregar esta linea
//     ],
//     ...
//   })
//
// Sin esto, NestJS no registra las rutas y todo devuelve 404.
