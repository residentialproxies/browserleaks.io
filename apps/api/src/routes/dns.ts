import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { DNSLeakService } from '../services/DNSLeakService';
import { IPService } from '../services/IPService';
import type { APIResponse, DNSLeakResult, DNSLeakRequest } from '@browserleaks/types';
import { telemetryService } from '../services/TelemetryService';
import { log } from '../middleware/logger';
import { getErrorMessage } from '../utils/errors';
import { validate } from '../middleware/validate';

const router = Router();
const dnsService = new DNSLeakService();
const ipService = new IPService();

const dnsRequestSchema = z.object({
  testId: z.string().optional(),
  userIp: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })).optional(),
  userCountry: z.string().length(2).optional(),
});

/**
 * POST /v1/detect/dns-leak
 * Detect DNS leaks
 */
router.post('/detect/dns-leak', validate(dnsRequestSchema), async (req, res) => {
  try {
    const { testId, userIp, userCountry }: Partial<DNSLeakRequest> = req.body;

    // If userIp not provided, get client IP
    const targetIP = userIp || ipService.getClientIP(req);

    // If userCountry not provided, detect it from IP
    let country = userCountry;
    if (!country) {
      const ipInfo = await ipService.detect(targetIP);
      country = ipInfo.geo.countryCode;
    }

    // Detect DNS leak
    const result = await dnsService.detect(targetIP, country);

    const response: APIResponse<DNSLeakResult> = {
      success: true,
      data: result,
    };

    res.json(response);

    const severity = result.leakType === 'full' ? 'high' : result.leakType === 'partial' ? 'medium' : 'low';
    const exposurePenalty = result.leakType === 'full' ? 45 : result.leakType === 'partial' ? 25 : 5;

    telemetryService
      .capture({
        type: 'dns-leak',
        source: 'dns-service',
        severity,
        summary: `${result.leakType.toUpperCase()} · ${result.servers[0]?.isp || 'unknown'}`,
        payload: result,
        snapshot: {
          privacyScore: Math.max(0, 100 - exposurePenalty),
          entropyScore: result.servers.length * 8,
          leaks: {
            webrtc: false,
            dns: result.leakType,
            battery: false,
            motion: false,
          },
          apiSurface: {
            resolver: result.servers[0]?.isp || 'unknown',
          },
          report: telemetryService.buildReportSnapshot({
            meta: { scanId: testId || `dns-${crypto.randomUUID()}`, time: Date.now() },
            privacyIndex: {
              score: Math.max(0, 100 - exposurePenalty),
              exposureLevel: severity,
              leakedBits: result.servers.length * 12,
            },
            networkLeaks: {
              dns: result.leakType,
              ip: targetIP,
            },
          }),
        },
      })
      .catch((error) => {
        log.warn('Telemetry capture failed (dns)', { error });
      });
  } catch (error: unknown) {
    log.error('DNS leak detection error', { error });

    const response: APIResponse = {
      success: false,
      error: {
        code: 'DNS_LEAK_DETECTION_ERROR',
        message: getErrorMessage(error) || 'Failed to detect DNS leak',
      },
    };

    res.status(500).json(response);
  }
});

export default router;
