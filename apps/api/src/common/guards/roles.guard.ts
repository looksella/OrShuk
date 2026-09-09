// apps/api/src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../../database/schema';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

// Jerarquia: un rol superior hereda los permisos de los inferiores.
const HIERARCHY: Record<UserRole, number> = {
  owner:   4,
  admin:   3,
  manager: 2,
  cashier: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser;
    if (!user) throw new ForbiddenException('Sesion no valida');

    const userLevel = HIERARCHY[user.role] ?? 0;
    const minLevel  = Math.min(...required.map((r) => HIERARCHY[r] ?? 99));

    if (userLevel < minLevel) {
      throw new ForbiddenException(
        `Tu rol (${user.role}) no tiene permiso para esta accion`,
      );
    }
    return true;
  }
}
