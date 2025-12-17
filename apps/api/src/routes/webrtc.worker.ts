/**
 * WebRTC Leak Detection Routes (Hono Worker)
 *
 * POST /v1/detect/webrtc-leak - Analyze WebRTC leak test results
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type { APIResponse, WebRTCLeakResult } from '@browserleaks/types';
import { WebRTCLeakService } from '../services/WebRTCLeakService.worker';

// Validation schema
const webrtcRequestSchema = z.object({
  publicIp: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })).optional(),
  localIPs: z.array(z.string()).default([]),
  candidates: z
    .array(
      z.object({
        ip: z.string(),
        type: z.string(),
        server: z.string().optional(),
      })
    )
    .default([]),
});

/**
 * Create WebRTC leak detection routes
 */
export function createWebRTCRoutes() {
  const router = new Hono<AppContext>();

  /**
   * POST /detect/webrtc-leak
   * Analyze WebRTC leak test results
   */
  router.post('/detect/webrtc-leak', zValidator('json', webrtcRequestSchema), async (c) => {
    try {
      const { publicIp, localIPs, candidates } = c.req.valid('json');
      const env = c.env as Env;

      // Get client IP if not specified
      const clientIP = c.get('clientIP');
      const targetIP = publicIp || clientIP;

      // Normalize candidates
      const normalizedCandidates = candidates.map((candidate) => ({
        ip: candidate.ip,
        type: candidate.type,
        server: candidate.server || 'unknown',
      }));

      // Create WebRTC service and analyze
      const webrtcService = new WebRTCLeakService(env);
      const result = await webrtcService.analyze(targetIP, localIPs, normalizedCandidates);

      const response: APIResponse<WebRTCLeakResult> = {
        success: true,
        data: result,
      };

      return c.json(response);
    } catch (error) {
      console.error('WebRTC leak detection error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'WEBRTC_LEAK_DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to analyze WebRTC leak',
        },
      };

      return c.json(response, 500);
    }
  });

  return router;
}
