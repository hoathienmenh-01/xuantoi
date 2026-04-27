import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[xuantoi/api] Production phải có env: ${missing.join(', ')}`,
    );
  }
  // Không cho dùng giá trị mặc định trong source.
  const insecureValues = new Set([
    'change-me-access-secret',
    'change-me-refresh-secret',
    'dev-access-secret',
    'dev-refresh-secret',
  ]);
  for (const k of required) {
    if (insecureValues.has(process.env[k] as string)) {
      throw new Error(
        `[xuantoi/api] Production không được dùng giá trị mặc định cho ${k}.`,
      );
    }
  }
}

function parseAllowedOrigins(): true | string[] {
  const raw = process.env.WEB_ORIGIN;
  if (!raw) return true; // dev: cho hết
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap(): Promise<void> {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: parseAllowedOrigins(),
      credentials: true,
    },
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`[xuantoi/api] listening on :${port}`);
}

bootstrap();
