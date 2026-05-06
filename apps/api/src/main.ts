import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:5173'),
    credentials: true
  });
  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
}

void bootstrap();
