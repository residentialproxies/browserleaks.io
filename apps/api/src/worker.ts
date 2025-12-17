/**
 * BrowserLeaks.io API Worker
 *
 * This is the main entry point for the Cloudflare Worker.
 * It replaces the Express server with Hono framework.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { Env, AppContext } from './types/env';

// Route imports
import { createIPRoutes } from './routes/ip.worker';
import { createDNSRoutes } from './routes/dns.worker';
import { createWebRTCRoutes } from './routes/webrtc.worker';
import { createFingerprintRoutes } from './routes/fingerprint.worker';
import { createPrivacyScoreRoutes } from './routes/privacy-score.worker';
import { createShareRoutes } from './routes/share.worker';
import { createHistoryRoutes } from './routes/history.worker';
import { createEventsRoutes } from './routes/events.worker';
import { createNetworkRoutes } from './routes/network.worker';
import { createAIChatRoutes } from './routes/ai.worker';

// Middleware imports
import { kvRateLimiter } from './middleware/rateLimiter.worker';
import { errorHandler } from './middleware/errorHandler.worker';

/**
 * Create the Hono app with typed environment
 */
const app = new Hono<AppContext>();

/**
 * Global middleware
 */

// Request ID and timing
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  const clientIP =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0';

  c.set('requestId', requestId);
  c.set('clientIP', clientIP);
  c.set('startTime', Date.now());

  // Set response headers
  c.header('X-Request-ID', requestId);

  await next();

  // Log request duration
  const duration = Date.now() - c.get('startTime');
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
});

// Secure headers (similar to Helmet)
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.ipify.org', 'https://ipinfo.io'],
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const env = c.env as Env;
      const corsOrigin = env.CORS_ORIGIN || 'https://browserleaks.io';
      const allowedOrigins =
        env.NODE_ENV === 'production'
          ? ['https://browserleaks.io', 'https://www.browserleaks.io']
          : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return corsOrigin;

      return allowedOrigins.includes(origin) ? origin : corsOrigin;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })
);

// Logging in development
app.use('*', logger());

/**
 * Health check endpoint
 */
app.get('/health', async (c) => {
  const env = c.env as Env;

  // Test D1 connection
  let dbStatus = 'unknown';
  try {
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
    console.error('D1 health check failed:', error);
  }

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    database: dbStatus,
  });
});

/**
 * API Info endpoint
 */
app.get('/v1', (c) => {
  return c.json({
    name: 'BrowserLeaks API',
    version: '2.0.0',
    runtime: 'Cloudflare Workers',
    endpoints: [
      'POST /v1/detect/ip',
      'GET /v1/detect/ip/:ip',
      'POST /v1/detect/dns-leak',
      'POST /v1/detect/webrtc-leak',
      'POST /v1/fingerprint',
      'POST /v1/fingerprint/scan',
      'GET /v1/fingerprint/:hash',
      'POST /v1/privacy-score',
      'GET /v1/history',
      'POST /v1/history',
      'POST /v1/history/compare',
      'GET /v1/history/:scanId',
      'DELETE /v1/history/:scanId',
      'POST /v1/share',
      'GET /v1/share/:code',
      'DELETE /v1/share/:code',
      'GET /v1/share/:code/stats',
      'GET /v1/events/stream',
    ],
  });
});

/**
 * Rate limiting middleware for /v1 routes
 */
app.use('/v1/*', kvRateLimiter);

/**
 * Mount API routes
 * Note: Routes are created as factory functions that receive the Hono app
 * This allows them to access the environment bindings via context
 */
app.route('/v1', createIPRoutes());
app.route('/v1', createDNSRoutes());
app.route('/v1', createWebRTCRoutes());
app.route('/v1/fingerprint', createFingerprintRoutes());
app.route('/v1', createPrivacyScoreRoutes());
app.route('/v1/share', createShareRoutes());
app.route('/v1/history', createHistoryRoutes());
app.route('/v1', createEventsRoutes());
app.route('/v1', createNetworkRoutes());
app.route('/v1', createAIChatRoutes());

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

/**
 * Global error handler
 */
app.onError(errorHandler);

/**
 * Export the Worker
 */
export default {
  fetch: app.fetch,
};
