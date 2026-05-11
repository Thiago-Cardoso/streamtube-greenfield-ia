import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainExceptionFilter(), new ValidationExceptionFilter());
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('app.appUrl') ?? 'http://localhost:3004',
    credentials: true,
  });
  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
void bootstrap();
