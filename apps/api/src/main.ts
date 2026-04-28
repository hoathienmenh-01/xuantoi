import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet, { type HelmetOptions } from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

const INSECURE_DEFAULTS = new Set([
  'change-me-access-secret',
  'change-me-refresh-secret',
  'dev-access-secret',
  'dev-refresh-secret',
]);

function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[xuantoi/api] Production phải có env: ${missing.join(', ')}`,
    );
  }
  for (const k of required) {
    const v = process.env[k] as string;
    if (INSECURE_DEFAULTS.has(v)) {
      throw new Error(
        `[xuantoi/api] Production không được dùng giá trị mặc định cho ${k}.`,
      );
    }
  }
}

function corsConfig(): { origin: string[] | boolean; credentials: boolean } {
  const env = process.env.CORS_ORIGINS;
  if (process.env.NODE_ENV === 'production') {
    if (!env) {
      throw new Error(
        '[xuantoi/api] Production phải có CORS_ORIGINS (csv list).',
      );
    }
    const origins = env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { origin: origins, credentials: true };
  }
  if (env) {
    const origins = env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { origin: origins, credentials: true };
  }
  // Dev fallback: Vite dev server.
  return { origin: ['http://localhost:5173'], credentials: true };
}

/**
 * Helmet config.
 *
 * Dev: tắt CSP — Vite dev server inline script / HMR / eval sẽ bị CSP chặn.
 *
 * Production: bật CSP với policy chặt phù hợp cho một REST + WebSocket API
 * không serve HTML. Nếu sau này host web static cùng domain, cần relax
 * `script-src`/`connect-src` theo domain CDN / WS endpoint.
 */
function helmetConfig(): HelmetOptions {
  if (process.env.NODE_ENV !== 'production') {
    return { contentSecurityPolicy: false };
  }
  return {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // API không render HTML → không cho inline script/style.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Giúp cache CDN phân biệt theo origin khi cần.
    crossOriginResourcePolicy: { policy: 'same-site' },
    // API trả JSON/WS, không cần allow cross-origin iframe/embed.
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    // HSTS 180 days, include subdomain (khi HTTPS-only).
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: false,
    },
  };
}

async function bootstrap(): Promise<void> {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule, {
    cors: corsConfig(),
  });
  app.use(helmet(helmetConfig()));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`[xuantoi/api] listening on :${port}`);
}

bootstrap();
