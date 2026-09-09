// apps/api/src/app.module.ts
// REEMPLAZA el archivo completo.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { join } from 'node:path';

@Module({
  imports: [
    ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    join(process.cwd(), '.env'),
    join(process.cwd(), '../../.env'),
  ],
}),
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // El orden importa: primero autentica, luego resuelve el tenant,
    // al final valida el rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
