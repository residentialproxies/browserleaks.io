import { Router } from 'express';
import { z } from 'zod';
import { WebRTCLeakService } from '../services/WebRTCLeakService';
import { IPService } from '../services/IPService';
import type { APIResponse, WebRTCLeakResult, WebRTCLeakRequest } from '@browserleaks/types';
import { telemetryService } from '../services/TelemetryService';
import { log } from '../middleware/logger';
import { getErrorMessage } from '../utils/errors';
import { validate } from '../middleware/validate';

const router = Router();
const webrtcService = new WebRTCLeakService();
const ipService = new IPService();

const webrtcRequestSchema = z.object({
  publicIp: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })).optional(),
  localIPs: z.array(z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' }))).default([]),
  candidates: z
    .array(
      z.object({
        ip: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
        type: z.string(),
        server: z.string().optional(),
      })
    )
    .default([]),
});

/**
 * POST /v1/detect/webrtc-leak
 * Analyze WebRTC leak test results
 */
router.post('/detect/webrtc-leak', validate(webrtcRequestSchema), async (req, res) => {
  try {
    const { publicIp, localIPs, candidates }: Partial<WebRTCLeakRequest> = req.body;

    const normalizedCandidates = (candidates || []).map((candidate) => ({
      ip: candidate.ip,
      type: candidate.type,
      server: candidate.server || 'unknown',
      country: (candidate as { country?: string }).country,
      countryCode: (candidate as { countryCode?: string }).countryCode,
    }));

    // If publicIp not provided, get client IP
    const targetIP = publicIp || ipService.getClientIP(req);

    // Analyze WebRTC leak
    const result = await webrtcService.analyze(targetIP, localIPs || [], normalizedCandidates);

    const response: APIResponse<WebRTCLeakResult> = {
      success: true,
      data: result,
    };

    res.json(response);

    const severity = result.isLeak ? 'high' : 'low';
    const penalty = result.isLeak ? 55 : 10;

    telemetryService
      .capture({
        type: 'webrtc-leak',
        source: 'webrtc-service',
        severity,
        summary: result.isLeak
          ? `Leak via ${result.localIPs[0] || 'local interface'}`
          : 'No local leak detected',
        payload: result,
        snapshot: {
          privacyScore: Math.max(0, 100 - penalty),
          entropyScore: result.stunResults.length * 12,
          leaks: {
            webrtc: result.isLeak,
            dns: 'none',
            battery: false,
            motion: false,
          },
          apiSurface: {
            WebRTC: result.isLeak ? 'leaking' : 'sealed',
          },
          report: telemetryService.buildReportSnapshot({
            meta: { scanId: `webrtc-${targetIP}`, time: Date.now() },
            privacyIndex: {
              score: Math.max(0, 100 - penalty),
              exposureLevel: severity,
              leakedBits: result.isLeak ? 64 : 4,
            },
            networkLeaks: {
              webrtc: result.isLeak ? result.localIPs.join(', ') : 'sealed',
              ip: targetIP,
            },
          }),
        },
      })
      .catch((error) => {
        log.warn('Telemetry capture failed (webrtc)', { error });
      });
  } catch (error: unknown) {
    log.error('WebRTC leak detection error', { error });

    const response: APIResponse = {
      success: false,
      error: {
        code: 'WEBRTC_LEAK_DETECTION_ERROR',
        message: getErrorMessage(error) || 'Failed to analyze WebRTC leak',
      },
    };

    res.status(500).json(response);
  }
});

export default router;
