// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      // El "as JwtModuleOptions" es necesario: jsonwebtoken exige que
      // expiresIn sea del tipo StringValue (formato '15m', '7d'), y una
      // variable de entorno siempre llega como string generico.
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
        },
      } as JwtModuleOptions),
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, PasswordService, JwtStrategy],
  exports:     [AuthService, PasswordService],
})
export class AuthModule {}
