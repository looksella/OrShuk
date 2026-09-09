// Va en: apps/api/src/common/interceptors/tenant.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (req.user) {
      if (!req.user.tenantId) {
        throw new UnauthorizedException('Token sin tenant asociado');
      }
      req.tenantId = req.user.tenantId;
      req.branchId = req.user.branchId ?? null;
    }

    return next.handle();
  }
}
