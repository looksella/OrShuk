// apps/api/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

// Uso:  metodo(@CurrentUser() user: AuthenticatedUser)
//       metodo(@CurrentUser('tenantId') tenantId: string)
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);

// Atajo dedicado al tenant, que es el parametro mas usado.
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return (req.user as AuthenticatedUser)?.tenantId;
  },
);
