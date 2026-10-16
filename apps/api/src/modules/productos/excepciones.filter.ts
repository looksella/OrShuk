// ============================================================
// apps/api/src/common/filters/excepciones.filter.ts
// ============================================================
// Esto resuelve el "Internal server error" que aparecia en la
// pantalla de login. Un cajero no debe ver jerga tecnica cuando
// algo se rompe: traduce errores de base de datos a mensajes
// utiles y registra el detalle completo solo en el servidor.
// ============================================================

import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Codigos SQLSTATE de Postgres que sabemos traducir
const ERRORES_POSTGRES: Record<string, { estado: number; mensaje: string }> = {
  '28P01': {
    estado: HttpStatus.SERVICE_UNAVAILABLE,
    mensaje: 'No se pudo conectar con la base de datos. Avise al administrador.',
  },
  '23505': {
    estado: HttpStatus.CONFLICT,
    mensaje: 'Ese registro ya existe.',
  },
  '23503': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'El registro esta vinculado a otros datos y no se puede modificar asi.',
  },
  '23514': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'Alguno de los valores enviados no es valido.',
  },
  '40001': {
    estado: HttpStatus.CONFLICT,
    mensaje: 'Otra operacion modifico estos datos al mismo tiempo. Intente de nuevo.',
  },
  '57014': {
    estado: HttpStatus.REQUEST_TIMEOUT,
    mensaje: 'La consulta tardo demasiado y se cancelo.',
  },
};

@Catch()
export class FiltroExcepcionesGlobal implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let estado = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensaje = 'Ocurrio un error inesperado. Intente de nuevo.';
    let detalle: unknown = undefined;

    // 1. Excepciones que ya lanzamos a proposito
    if (exception instanceof HttpException) {
      estado = exception.getStatus();
      const cuerpo = exception.getResponse();
      if (typeof cuerpo === 'string') {
        mensaje = cuerpo;
      } else if (typeof cuerpo === 'object' && cuerpo !== null) {
        const c = cuerpo as Record<string, unknown>;
        mensaje = (c.message as string) ?? mensaje;
        detalle = c.errors ?? c.detalle;
      }
    }
    // 2. Errores de Postgres, incluyendo los envueltos por Drizzle
    else {
      const codigo = this.extraerCodigoSql(exception);
      const conocido = codigo ? ERRORES_POSTGRES[codigo] : undefined;

      if (conocido) {
        estado = conocido.estado;
        mensaje = conocido.mensaje;
      }

      // Los mensajes que lanza fn_mover_stock estan escritos
      // para el usuario final, asi que se pasan tal cual.
      const textoSql = this.extraerMensajeSql(exception);
      if (textoSql?.includes('Stock insuficiente')) {
        estado = HttpStatus.CONFLICT;
        mensaje = textoSql;
      }
      if (textoSql?.includes('solo insercion')) {
        estado = HttpStatus.FORBIDDEN;
        mensaje = 'El historial de inventario no se puede modificar. Registre un ajuste.';
      }
    }

    // El detalle tecnico completo queda en el log del servidor,
    // nunca viaja al navegador.
    const nivel = estado >= 500 ? 'error' : 'warn';
    this.logger[nivel](
      `${req.method} ${req.url} -> ${estado} | ${mensaje}`,
      estado >= 500 ? (exception as Error)?.stack : undefined,
    );

    res.status(estado).json({
      statusCode: estado,
      message: mensaje,
      ...(detalle ? { errors: detalle } : {}),
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }

  private extraerCodigoSql(e: unknown): string | undefined {
    const cualquiera = e as any;
    return cualquiera?.code
        ?? cualquiera?.cause?.code
        ?? cualquiera?.cause?.cause?.code;
  }

  private extraerMensajeSql(e: unknown): string | undefined {
    const cualquiera = e as any;
    return cualquiera?.cause?.message
        ?? cualquiera?.cause?.cause?.message
        ?? cualquiera?.message;
  }
}

// ------------------------------------------------------------
// RECORDATORIO: registrar en apps/api/src/main.ts
// ------------------------------------------------------------
//
//   import { FiltroExcepcionesGlobal } from './common/filters/excepciones.filter';
//
//   app.useGlobalFilters(new FiltroExcepcionesGlobal());
//
// Ponelo despues del ValidationPipe y antes del app.listen().
