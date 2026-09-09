// apps/api/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import type { UserRole } from '../../../database/schema';

export interface JwtPayload {
  sub:      string; // userId
  tenantId: string;
  branchId: string | null;
  role:     UserRole;
  email:    string;
}

export interface AuthenticatedUser {
  userId:   string;
  tenantId: string;
  branchId: string | null;
  role:     UserRole;
  email:    string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Lo que retorna este metodo queda en req.user
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.tenantId) {
      throw new UnauthorizedException('Token sin empresa asociada');
    }

    // Verificamos contra la base que el usuario siga activo. Evita que
    // un token valido siga sirviendo tras desactivar la cuenta.
    const user = await this.users.findActiveById(payload.tenantId, payload.sub);
    if (!user) {
      throw new UnauthorizedException('La cuenta esta inactiva o fue eliminada');
    }

    return {
      userId:   payload.sub,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      role:     payload.role,
      email:    payload.email,
    };
  }
}
