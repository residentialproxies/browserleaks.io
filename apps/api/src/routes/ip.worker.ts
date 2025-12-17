/**
 * IP Detection Routes (Hono Worker)
 *
 * POST /v1/detect/ip - Detect client or specified IP
 * GET /v1/detect/ip/:ip - Lookup specific IP
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type { APIResponse, IPLeakResult } from '@browserleaks/types';
import { IPService } from '../services/IPService.worker';

// Validation schemas
const ipRequestSchema = z.object({
  ip: z
    .string()
    .ip({ version: 'v4' })
    .or(z.string().ip({ version: 'v6' }))
    .optional(),
});

const ipParamSchema = z.object({
  ip: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
});

/**
 * Create IP detection routes
 */
export function createIPRoutes() {
  const router = new Hono<AppContext>();

  /**
   * POST /detect/ip
   * Detect IP information for client or specified IP
   */
  router.post('/detect/ip', zValidator('json', ipRequestSchema), async (c) => {
    try {
      const { ip } = c.req.valid('json');
      const env = c.env as Env;

      // Get client IP if not specified
      const clientIP = c.get('clientIP');
      const targetIP = ip || clientIP;

      // Create IP service with env
      const ipService = new IPService(env);

      // Detect IP information
      const result = await ipService.detect(targetIP);

      const response: APIResponse<IPLeakResult> = {
        success: true,
        data: result,
      };

      return c.json(response);
    } catch (error) {
      console.error('IP detection error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'IP_DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect IP',
        },
      };

      return c.json(response, 500);
    }
  });

  /**
   * GET /detect/ip/:ip
   * Lookup specific IP information
   */
  router.get('/detect/ip/:ip', zValidator('param', ipParamSchema), async (c) => {
    try {
      const { ip } = c.req.valid('param');
      const env = c.env as Env;

      // Create IP service with env
      const ipService = new IPService(env);

      // Detect IP information
      const result = await ipService.detect(ip);

      const response: APIResponse<IPLeakResult> = {
        success: true,
        data: result,
      };

      return c.json(response);
    } catch (error) {
      console.error('IP detection error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'IP_DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect IP',
        },
      };

      return c.json(response, 500);
    }
  });

  return router;
}
