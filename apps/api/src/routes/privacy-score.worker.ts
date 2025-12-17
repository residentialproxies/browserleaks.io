/**
 * Privacy Score Routes (Hono Worker)
 *
 * POST /v1/privacy-score - Calculate comprehensive privacy score
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type { APIResponse, PrivacyScore } from '@browserleaks/types';
import { PrivacyScoreService } from '../services/PrivacyScoreService';

// Validation schema - NOW WITH PROPER VALIDATION (fixing P0 issue)
const ipLeakSchema = z
  .object({
    ip: z.string().optional(),
    version: z.string().optional(),
    geo: z
      .object({
        country: z.string().optional(),
        countryCode: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
      })
      .optional(),
    privacy: z
      .object({
        isProxy: z.boolean().optional(),
        isVPN: z.boolean().optional(),
        isDatacenter: z.boolean().optional(),
        isTor: z.boolean().optional(),
      })
      .optional(),
    reputation: z
      .object({
        score: z.number().optional(),
      })
      .optional(),
  })
  .optional();

const dnsLeakSchema = z
  .object({
    testId: z.string().optional(),
    isLeak: z.boolean().optional(),
    leakType: z.enum(['none', 'partial', 'full']).optional(),
    servers: z.array(z.unknown()).optional(),
  })
  .optional();

const webrtcLeakSchema = z
  .object({
    isLeak: z.boolean().optional(),
    localIPs: z.array(z.string()).optional(),
    publicIP: z.string().optional(),
  })
  .optional();

const fingerprintSchema = z
  .object({
    canvasHash: z.string().optional(),
    webglHash: z.string().optional(),
    audioHash: z.string().optional(),
    fontHash: z.string().optional(),
    uniquenessScore: z.number().optional(),
  })
  .optional();

const browserConfigSchema = z
  .object({
    doNotTrack: z.boolean().optional(),
    cookiesEnabled: z.boolean().optional(),
    adBlockEnabled: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
  })
  .optional();

const privacyScoreRequestSchema = z.object({
  ipLeak: ipLeakSchema,
  dnsLeak: dnsLeakSchema,
  webrtcLeak: webrtcLeakSchema,
  fingerprint: fingerprintSchema,
  browserConfig: browserConfigSchema,
});

/**
 * Create privacy score routes
 */
export function createPrivacyScoreRoutes() {
  const router = new Hono<AppContext>();

  /**
   * POST /privacy-score
   * Calculate comprehensive privacy score
   */
  router.post('/privacy-score', zValidator('json', privacyScoreRequestSchema), async (c) => {
    try {
      const data = c.req.valid('json');

      // Calculate privacy score using the service
      const privacyScoreService = new PrivacyScoreService();
      const result = await privacyScoreService.calculate(data);

      const response: APIResponse<PrivacyScore> = {
        success: true,
        data: result,
      };

      return c.json(response);
    } catch (error) {
      console.error('Privacy score calculation error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'PRIVACY_SCORE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to calculate privacy score',
        },
      };

      return c.json(response, 500);
    }
  });

  return router;
}
