/**
 * KV-based Rate Limiter for Cloudflare Workers
 *
 * Replaces express-rate-limit with KV store for distributed rate limiting.
 * State persists across Worker instances and survives restarts.
 */

import type { Context, Next } from 'hono';
import type { AppContext, Env } from '../types/env';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for KV keys
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // 100 requests per day for free tier
  keyPrefix: 'rate_limit:',
};

/**
 * Get client IP from various headers
 */
function getClientIP(c: Context<AppContext>): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    '0.0.0.0'
  );
}

/**
 * Create rate limiter middleware with custom config
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, max, keyPrefix } = { ...DEFAULT_CONFIG, ...config };
  const windowSeconds = Math.floor(windowMs / 1000);

  return async (c: Context<AppContext>, next: Next) => {
    const env = c.env as Env;

    // Skip rate limiting if KV is not available (development mode)
    if (!env.RATE_LIMIT) {
      console.warn('KV RATE_LIMIT not available, skipping rate limiting');
      await next();
      return;
    }

    const clientIP = getClientIP(c);
    const key = `${keyPrefix}${clientIP}`;

    try {
      // Get current count from KV
      const currentData = await env.RATE_LIMIT.get(key, { type: 'json' }) as { count: number; resetAt: number } | null;

      const now = Date.now();
      let count = 1;
      let resetAt = now + windowMs;

      if (currentData) {
        // Check if window has expired
        if (now < currentData.resetAt) {
          count = currentData.count + 1;
          resetAt = currentData.resetAt;
        }
        // If window expired, start fresh with count = 1
      }

      // Set rate limit headers
      c.header('X-RateLimit-Limit', max.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, max - count).toString());
      c.header('X-RateLimit-Reset', Math.floor(resetAt / 1000).toString());

      // Check if limit exceeded
      if (count > max) {
        c.header('Retry-After', Math.ceil((resetAt - now) / 1000).toString());

        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              retryAfter: Math.ceil((resetAt - now) / 1000),
            },
          },
          429
        );
      }

      // Store updated count in KV with expiration
      await env.RATE_LIMIT.put(
        key,
        JSON.stringify({ count, resetAt }),
        { expirationTtl: windowSeconds }
      );

      await next();
    } catch (error) {
      // On KV error, log and allow the request (fail open)
      console.error('Rate limiter error:', error);
      await next();
    }
  };
}

/**
 * Standard rate limiter: 100 requests per 24 hours
 */
export const kvRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100,
});

/**
 * Strict rate limiter: 10 requests per minute (for expensive operations)
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyPrefix: 'strict_limit:',
});

/**
 * Burst rate limiter: 10 requests per second (for anti-abuse)
 */
export const burstRateLimiter = createRateLimiter({
  windowMs: 1000, // 1 second
  max: 10,
  keyPrefix: 'burst_limit:',
});
