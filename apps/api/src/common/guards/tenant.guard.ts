// apps/api/src/common/guards/tenant.guard.ts
// Ultima linea de defensa: si un request autenticado llega sin tenantId,
// se rechaza antes de tocar el controlador.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req  = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;

    if (!user?.tenantId) {
      throw new UnauthorizedException('Peticion sin empresa asociada');
    }

    req.tenantId = user.tenantId;
    return true;
  }
}
