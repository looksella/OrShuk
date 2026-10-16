import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FiltroExcepcionesGlobal } from './common/filters/excepciones.filter';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new FiltroExcepcionesGlobal());

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API OrShuk escuchando en http://localhost:${port}/api`);
}


bootstrap();
