/**
 * Cloudflare Worker Environment Types
 *
 * This file defines the environment bindings available in the Worker.
 * Bindings are configured in wrangler.toml and passed to handlers via `env`.
 */

import type { D1Database, KVNamespace, ExecutionContext } from '@cloudflare/workers-types';

/**
 * Environment bindings available in the Worker
 */
export interface Env {
  // D1 Database (SQLite-based serverless SQL)
  DB: D1Database;

  // KV Namespaces
  CACHE: KVNamespace; // For caching IP lookups, fingerprints
  RATE_LIMIT: KVNamespace; // For rate limiting state

  // Environment Variables (from wrangler.toml [vars])
  NODE_ENV: string;
  CORS_ORIGIN: string;

  // Secrets (set via `wrangler secret put`)
  IPINFO_TOKEN: string;
  JWT_SECRET: string;
  OPENROUTER_API_KEY?: string;
  CLOUDFLARE_RADAR_TOKEN?: string;
  CF_WORKER_DNS_BEACON_URL?: string;
  CF_WORKER_JA3_URL?: string;
}

/**
 * Hono context with typed environment
 */
export type AppContext = {
  Bindings: Env;
  Variables: {
    requestId: string;
    clientIP: string;
    startTime: number;
  };
};

/**
 * Re-export execution context
 */
export type { ExecutionContext };
