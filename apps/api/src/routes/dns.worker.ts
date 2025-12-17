/**
 * DNS Leak Detection Routes (Hono Worker)
 *
 * POST /v1/detect/dns-leak - Detect DNS leaks
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type { APIResponse, DNSLeakResult } from '@browserleaks/types';
import { DNSLeakService } from '../services/DNSLeakService.worker';
import { IPService } from '../services/IPService.worker';

// Validation schema
const dnsRequestSchema = z.object({
  testId: z.string().optional(),
  userIp: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })).optional(),
  userCountry: z.string().length(2).optional(),
});

/**
 * Create DNS leak detection routes
 */
export function createDNSRoutes() {
  const router = new Hono<AppContext>();

  /**
   * POST /detect/dns-leak
   * Detect DNS leaks
   */
  router.post('/detect/dns-leak', zValidator('json', dnsRequestSchema), async (c) => {
    try {
      const { testId, userIp, userCountry } = c.req.valid('json');
      const env = c.env as Env;

      // Get client IP if not specified
      const clientIP = c.get('clientIP');
      const targetIP = userIp || clientIP;

      // Get user country if not specified
      let country = userCountry;
      if (!country) {
        try {
          const ipService = new IPService(env);
          const ipInfo = await ipService.detect(targetIP);
          country = ipInfo.geo.countryCode;
        } catch {
          country = 'US'; // Default fallback
        }
      }

      // Create DNS service and detect leak
      const dnsService = new DNSLeakService(env);
      const result = await dnsService.detect(targetIP, country);

      const response: APIResponse<DNSLeakResult> = {
        success: true,
        data: result,
      };

      return c.json(response);
    } catch (error) {
      console.error('DNS leak detection error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'DNS_LEAK_DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect DNS leak',
        },
      };

      return c.json(response, 500);
    }
  });

  return router;
}
