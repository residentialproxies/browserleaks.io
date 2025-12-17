/**
 * Fingerprint Analysis Routes (Hono Worker)
 *
 * Endpoints for analyzing browser fingerprints and calculating uniqueness.
 * Uses Web Crypto API for hashing (Worker compatible).
 *
 * POST /v1/fingerprint - Analyze fingerprint
 * POST /v1/fingerprint/scan - Full privacy scan
 * GET /v1/fingerprint/:hash - Get fingerprint statistics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type {
  APIResponse,
  PrivacyScore,
  IPLeakResult,
  DNSLeakResult,
  WebRTCLeakResult,
  RiskLevel,
} from '@browserleaks/types';
import { IPService } from '../services/IPService.worker';
import { PrivacyScoreService } from '../services/PrivacyScoreService';

// Validation schemas
const fingerprintSchema = z.object({
  canvas: z
    .object({
      hash: z.string(),
      winding: z.boolean(),
      geometry: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),

  webgl: z
    .object({
      hash: z.string(),
      vendor: z.string(),
      renderer: z.string(),
      version: z.string().optional(),
      shadingLanguageVersion: z.string().optional(),
      extensions: z.array(z.string()).optional(),
      parameters: z.record(z.unknown()).optional(),
    })
    .optional(),

  audio: z
    .object({
      hash: z.string(),
      value: z.number(),
      sampleRate: z.number().optional(),
      channelCount: z.number().optional(),
    })
    .optional(),

  fonts: z
    .object({
      hash: z.string(),
      count: z.number(),
      list: z.array(z.string()),
    })
    .optional(),

  timezone: z
    .object({
      name: z.string(),
      offset: z.number(),
      hasDST: z.boolean().optional(),
    })
    .optional(),

  screen: z
    .object({
      width: z.number(),
      height: z.number(),
      colorDepth: z.number(),
      pixelRatio: z.number(),
      availWidth: z.number().optional(),
      availHeight: z.number().optional(),
      orientation: z.string().optional(),
    })
    .optional(),

  navigator: z
    .object({
      platform: z.string(),
      language: z.string(),
      languages: z.array(z.string()),
      hardwareConcurrency: z.number(),
      deviceMemory: z.number().optional(),
      maxTouchPoints: z.number(),
      userAgent: z.string().optional(),
      cookieEnabled: z.boolean().optional(),
      doNotTrack: z.string().nullable().optional(),
    })
    .optional(),

  browser: z
    .object({
      engine: z.string(),
      isMobile: z.boolean(),
      isChromium: z.boolean(),
      isGecko: z.boolean(),
      isWebKit: z.boolean(),
    })
    .optional(),

  storage: z
    .object({
      localStorage: z.boolean(),
      sessionStorage: z.boolean(),
      indexedDB: z.boolean(),
    })
    .optional(),

  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
});

const scanSchema = z.object({
  fingerprint: fingerprintSchema,
  ipLeak: z
    .object({
      ip: z.string(),
      version: z.string().optional(),
    })
    .optional(),
  dnsLeak: z
    .object({
      testId: z.string().optional(),
      isLeak: z.boolean(),
      leakType: z.enum(['none', 'partial', 'full']),
      servers: z.array(
        z.object({
          ip: z.string(),
          hostname: z.string().optional(),
          isp: z.string().optional(),
          country: z.string().optional(),
        })
      ),
    })
    .optional(),
  webrtcLeak: z
    .object({
      isLeak: z.boolean(),
      localIPs: z.array(z.string()),
      publicIP: z.string().optional(),
      ipv6: z.string().optional(),
    })
    .optional(),
});

type FingerprintData = z.infer<typeof fingerprintSchema>;

/**
 * Create fingerprint routes
 */
export function createFingerprintRoutes() {
  const router = new Hono<AppContext>();
  const privacyScoreService = new PrivacyScoreService();

  /**
   * POST /fingerprint
   * Analyze a browser fingerprint and return uniqueness score
   */
  router.post('/', zValidator('json', fingerprintSchema), async (c) => {
    try {
      const data = c.req.valid('json');

      // Generate combined hash
      const combinedHash = await generateCombinedHash(data);

      // Calculate component uniqueness scores
      const componentScores = calculateComponentScores(data);

      // Calculate overall uniqueness
      const uniquenessScore = calculateUniquenessScore(componentScores);

      // Build analysis result
      const analysis = {
        combinedHash,
        uniquenessScore,
        uniquenessPercentage: Math.round(uniquenessScore * 100),
        componentScores,
        components: {
          canvas: data.canvas
            ? {
                detected: true,
                hash: data.canvas.hash,
                winding: data.canvas.winding,
              }
            : { detected: false },
          webgl: data.webgl
            ? {
                detected: true,
                hash: data.webgl.hash,
                vendor: data.webgl.vendor,
                renderer: data.webgl.renderer,
                extensionCount: data.webgl.extensions?.length || 0,
              }
            : { detected: false },
          audio: data.audio
            ? {
                detected: true,
                hash: data.audio.hash,
                value: data.audio.value,
              }
            : { detected: false },
          fonts: data.fonts
            ? {
                detected: true,
                hash: data.fonts.hash,
                count: data.fonts.count,
              }
            : { detected: false },
          timezone: data.timezone
            ? {
                detected: true,
                name: data.timezone.name,
                offset: data.timezone.offset,
              }
            : { detected: false },
          screen: data.screen
            ? {
                detected: true,
                resolution: `${data.screen.width}x${data.screen.height}`,
                colorDepth: data.screen.colorDepth,
                pixelRatio: data.screen.pixelRatio,
              }
            : { detected: false },
          navigator: data.navigator
            ? {
                detected: true,
                platform: data.navigator.platform,
                language: data.navigator.language,
                hardwareConcurrency: data.navigator.hardwareConcurrency,
                deviceMemory: data.navigator.deviceMemory,
              }
            : { detected: false },
          browser: data.browser
            ? {
                detected: true,
                engine: data.browser.engine,
                isMobile: data.browser.isMobile,
              }
            : { detected: false },
        },
        riskAssessment: {
          level:
            uniquenessScore > 0.9
              ? 'critical'
              : uniquenessScore > 0.7
                ? 'high'
                : uniquenessScore > 0.5
                  ? 'medium'
                  : 'low',
          trackable: uniquenessScore > 0.7,
          recommendations: generateRecommendations(uniquenessScore, componentScores),
        },
        timestamp: new Date().toISOString(),
      };

      const response: APIResponse<typeof analysis> = {
        success: true,
        data: analysis,
      };

      return c.json(response);
    } catch (error) {
      console.error('Fingerprint analysis error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'FINGERPRINT_ANALYSIS_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze fingerprint',
          },
        },
        500
      );
    }
  });

  /**
   * POST /fingerprint/scan
   * Full privacy scan including fingerprint, IP, DNS, and WebRTC
   */
  router.post('/scan', zValidator('json', scanSchema), async (c) => {
    try {
      const { fingerprint, ipLeak, dnsLeak, webrtcLeak } = c.req.valid('json');
      const env = c.env as Env;
      const useMock = c.req.query('mock') === 'true';

      if (useMock) {
        const mock = buildMockScanResult();
        return c.json({ success: true, data: mock });
      }

      // Get client IP
      const clientIP = c.get('clientIP');
      const actualIP = ipLeak?.ip || clientIP;

      // Get IP intelligence
      const ipService = new IPService(env);
      const ipIntelligence = await ipService.detect(actualIP);

      // Generate visitor ID if not provided
      const visitorId =
        fingerprint.visitorId || (await generateVisitorId(fingerprint, actualIP));
      const sessionId = fingerprint.sessionId || generateSessionId();

      // Analyze fingerprint
      const combinedHash = await generateCombinedHash(fingerprint);
      const componentScores = calculateComponentScores(fingerprint);
      const uniquenessScore = calculateUniquenessScore(componentScores);

      const ipLeakResult: IPLeakResult | undefined = ipIntelligence
        ? {
            ip: actualIP,
            version: (ipIntelligence.version as 'ipv4' | 'ipv6') || 'ipv4',
            geo: {
              country: ipIntelligence.geo.country || 'Unknown',
              countryCode: ipIntelligence.geo.countryCode || 'XX',
              city: ipIntelligence.geo.city || 'Unknown',
              region: ipIntelligence.geo.region || 'Unknown',
              latitude: ipIntelligence.geo.latitude || 0,
              longitude: ipIntelligence.geo.longitude || 0,
              timezone: ipIntelligence.geo.timezone || 'Unknown',
            },
            network: {
              isp: ipIntelligence.network.isp || 'Unknown',
              asn: ipIntelligence.network.asn || '0',
              organization: ipIntelligence.network.organization || 'Unknown',
            },
            privacy: {
              isVPN: ipIntelligence.privacy.isVPN ?? false,
              isProxy: ipIntelligence.privacy.isProxy ?? false,
              isTor: ipIntelligence.privacy.isTor ?? false,
              isDatacenter: ipIntelligence.privacy.isDatacenter ?? false,
              isRelay: ipIntelligence.privacy.isRelay ?? false,
            },
            reputation: {
              score: ipIntelligence.reputation.score ?? 100,
              isBlacklisted: ipIntelligence.reputation.isBlacklisted ?? false,
              categories: ipIntelligence.reputation.categories || [],
            },
          }
        : undefined;

      const dnsLeakResult: DNSLeakResult | undefined = dnsLeak
        ? {
            testId: dnsLeak.testId || `dns-${generateScanId()}`,
            isLeak: dnsLeak.isLeak,
            leakType: dnsLeak.leakType,
            servers: dnsLeak.servers.map((server, idx) => ({
              ip: server.ip,
              country: server.country || 'Unknown',
              countryCode: (server.country || 'XX').slice(0, 2).toUpperCase(),
              isp: server.isp || 'Unknown',
              isISP: !!server.isp || idx === 0,
            })),
            dohEnabled: false,
            dotEnabled: false,
            risks: [],
            recommendations: [],
          }
        : undefined;

      const webrtcLeakResult: WebRTCLeakResult | undefined = webrtcLeak
        ? {
            isLeak: webrtcLeak.isLeak,
            localIPs: webrtcLeak.localIPs,
            publicIPs: webrtcLeak.publicIP ? [webrtcLeak.publicIP] : [],
            natType: 'unknown',
            mdnsLeak: false,
            ipv6Leak: Boolean(webrtcLeak.ipv6),
            stunResults: [],
            riskLevel: webrtcLeak.isLeak ? 'critical' : 'low',
            risks: webrtcLeak.isLeak
              ? [
                  {
                    severity: 'high' as RiskLevel,
                    title: 'WebRTC exposure',
                    description: 'WebRTC reported IP addresses',
                  },
                ]
              : [],
            recommendations: webrtcLeak.isLeak
              ? ['Disable WebRTC or restrict ICE servers']
              : [],
          }
        : undefined;

      // Calculate privacy score
      const privacyScore = await privacyScoreService.calculate({
        ipLeak: ipLeakResult,
        dnsLeak: dnsLeakResult,
        webrtcLeak: webrtcLeakResult,
        fingerprint: {
          uniquenessScore: uniquenessScore * 100,
        },
      });

      // Build comprehensive scan result
      const scanResult = {
        scanId: generateScanId(),
        visitorId,
        sessionId,
        timestamp: new Date().toISOString(),

        privacyScore: {
          total: privacyScore.totalScore,
          riskLevel: privacyScore.riskLevel,
          breakdown: privacyScore.breakdown,
          vulnerabilities: privacyScore.vulnerabilities,
        },

        fingerprint: {
          combinedHash,
          uniquenessScore,
          uniquenessPercentage: Math.round(uniquenessScore * 100),
          componentScores,
          riskLevel:
            uniquenessScore > 0.9
              ? 'critical'
              : uniquenessScore > 0.7
                ? 'high'
                : uniquenessScore > 0.5
                  ? 'medium'
                  : 'low',
        },

        ip: {
          address: actualIP,
          version: ipIntelligence.version,
          geolocation: {
            country: ipIntelligence.geo.country,
            countryCode: ipIntelligence.geo.countryCode,
            city: ipIntelligence.geo.city,
            region: ipIntelligence.geo.region,
            latitude: ipIntelligence.geo.latitude,
            longitude: ipIntelligence.geo.longitude,
            timezone: ipIntelligence.geo.timezone,
          },
          network: {
            asn: ipIntelligence.network.asn,
            asnName: ipIntelligence.network.organization,
            organization: ipIntelligence.network.organization,
          },
          privacy: {
            isVpn: ipIntelligence.privacy.isVPN,
            isProxy: ipIntelligence.privacy.isProxy,
            isTor: ipIntelligence.privacy.isTor,
            isDatacenter: ipIntelligence.privacy.isDatacenter,
            isRelay: ipIntelligence.privacy.isRelay,
          },
          reputation: {
            score: ipIntelligence.reputation.score,
            isBlacklisted: ipIntelligence.reputation.isBlacklisted,
          },
        },

        dns: dnsLeak
          ? {
              isLeak: dnsLeak.isLeak,
              leakType: dnsLeak.leakType,
              serverCount: dnsLeak.servers.length,
              servers: dnsLeak.servers,
            }
          : null,

        webrtc: webrtcLeak
          ? {
              isLeak: webrtcLeak.isLeak,
              localIPs: webrtcLeak.localIPs,
              publicIP: webrtcLeak.publicIP,
              ipv6: webrtcLeak.ipv6,
            }
          : null,

        recommendations: generateComprehensiveRecommendations(
          privacyScore,
          uniquenessScore,
          ipIntelligence
        ),
      };

      const response: APIResponse<typeof scanResult> = {
        success: true,
        data: scanResult,
      };

      return c.json(response);
    } catch (error) {
      console.error('Full scan error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'SCAN_ERROR',
            message: error instanceof Error ? error.message : 'Failed to perform privacy scan',
          },
        },
        500
      );
    }
  });

  /**
   * GET /fingerprint/:hash
   * Get fingerprint statistics by hash
   */
  router.get('/:hash', async (c) => {
    try {
      const { hash } = c.req.param();
      const env = c.env as Env;

      // Check cache first
      const cached = await env.CACHE.get(`fp:${hash}`);
      if (cached) {
        return c.json({
          success: true,
          data: JSON.parse(cached),
        });
      }

      // Query D1 for fingerprint stats
      const result = await env.DB.prepare(
        `SELECT hash, seen_count, first_seen_at, last_seen_at
         FROM shared_fingerprints WHERE hash = ?`
      )
        .bind(hash)
        .first<{
          hash: string;
          seen_count: number;
          first_seen_at: string;
          last_seen_at: string;
        }>();

      if (result) {
        const stats = {
          hash: result.hash,
          seenCount: result.seen_count,
          firstSeen: result.first_seen_at,
          lastSeen: result.last_seen_at,
          uniqueness: Math.max(0.7, 1 - result.seen_count / 1000),
          similarFingerprints: Math.min(result.seen_count, 10),
        };

        // Cache for 1 hour
        await env.CACHE.put(`fp:${hash}`, JSON.stringify(stats), { expirationTtl: 3600 });

        return c.json({
          success: true,
          data: stats,
        });
      }

      // Return simulated stats for unknown fingerprints
      const stats = {
        hash,
        seenCount: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        uniqueness: 0.95,
        similarFingerprints: 0,
      };

      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Fingerprint lookup error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'FINGERPRINT_LOOKUP_ERROR',
            message: error instanceof Error ? error.message : 'Failed to lookup fingerprint',
          },
        },
        500
      );
    }
  });

  return router;
}

// Helper functions using Web Crypto API

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateCombinedHash(data: FingerprintData): Promise<string> {
  const parts = [
    data.canvas?.hash || '',
    data.webgl?.hash || '',
    data.audio?.hash || '',
    data.fonts?.hash || '',
    data.timezone?.name || '',
    data.screen ? `${data.screen.width}x${data.screen.height}` : '',
    data.navigator?.platform || '',
    data.navigator?.language || '',
  ].join('|');

  return sha256(parts);
}

function calculateComponentScores(data: FingerprintData): Record<string, number> {
  const scores: Record<string, number> = {};

  if (data.canvas?.hash) {
    scores.canvas = 0.85 + Math.random() * 0.15;
  }

  if (data.webgl?.hash) {
    scores.webgl = 0.7 + Math.random() * 0.25;
  }

  if (data.audio?.hash) {
    scores.audio = 0.65 + Math.random() * 0.3;
  }

  if (data.fonts) {
    const fontFactor = Math.min(data.fonts.count / 100, 1);
    scores.fonts = 0.5 + fontFactor * 0.4;
  }

  if (data.timezone) {
    scores.timezone = 0.2 + Math.random() * 0.3;
  }

  if (data.screen) {
    const isCommonResolution = [
      '1920x1080',
      '1366x768',
      '1536x864',
      '1440x900',
      '2560x1440',
    ].includes(`${data.screen.width}x${data.screen.height}`);
    scores.screen = isCommonResolution ? 0.3 : 0.6;
  }

  if (data.navigator) {
    scores.navigator = 0.4 + Math.random() * 0.3;
  }

  return scores;
}

function calculateUniquenessScore(componentScores: Record<string, number>): number {
  const values = Object.values(componentScores);
  if (values.length === 0) return 0.5;

  const weights: Record<string, number> = {
    canvas: 0.25,
    webgl: 0.2,
    audio: 0.15,
    fonts: 0.15,
    timezone: 0.05,
    screen: 0.1,
    navigator: 0.1,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, score] of Object.entries(componentScores)) {
    const weight = weights[key] || 0.1;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

function generateRecommendations(
  uniqueness: number,
  componentScores: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  if (uniqueness > 0.8) {
    recommendations.push(
      'Use a privacy-focused browser like Firefox with Enhanced Tracking Protection.'
    );
  }

  if (componentScores.canvas && componentScores.canvas > 0.8) {
    recommendations.push('Enable canvas fingerprint protection (e.g., CanvasBlocker extension).');
  }

  if (componentScores.webgl && componentScores.webgl > 0.8) {
    recommendations.push('Consider disabling WebGL or using WebGL fingerprint protection.');
  }

  if (componentScores.fonts && componentScores.fonts > 0.6) {
    recommendations.push(
      'Reduce installed fonts or use a font fingerprinting protection extension.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Your browser fingerprint has moderate uniqueness. Good privacy practices.');
  }

  return recommendations;
}

function generateComprehensiveRecommendations(
  privacyScore: PrivacyScore,
  uniqueness: number,
  ipIntelligence: { privacy: { isVPN: boolean; isTor: boolean } }
): string[] {
  const recommendations: string[] = [];

  if (!ipIntelligence.privacy.isVPN && !ipIntelligence.privacy.isTor) {
    recommendations.push('Use a reputable VPN service to hide your real IP address.');
  }

  if (privacyScore.breakdown.dnsPrivacy < 10) {
    recommendations.push('Enable DNS-over-HTTPS (DoH) in your browser settings.');
  }

  if (privacyScore.breakdown.webrtcPrivacy < 10) {
    recommendations.push('Disable WebRTC or use a browser extension to prevent IP leaks.');
  }

  if (uniqueness > 0.8) {
    recommendations.push('Use a privacy browser with fingerprint protection (Firefox, Brave).');
  }

  if (privacyScore.totalScore < 60) {
    recommendations.push('Consider using Tor Browser for maximum privacy protection.');
  }

  return recommendations.slice(0, 5);
}

async function generateVisitorId(data: FingerprintData, ip: string): Promise<string> {
  const parts = [
    data.canvas?.hash || '',
    data.webgl?.hash || '',
    data.navigator?.platform || '',
    ip,
  ].join('|');
  const hash = await sha256(parts);
  return hash.substring(0, 24);
}

function generateSessionId(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

function generateScanId(): string {
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildMockScanResult() {
  return {
    scanId: 'mock-scan',
    visitorId: 'visitor-mock',
    sessionId: 'session-mock',
    timestamp: new Date().toISOString(),
    privacyScore: {
      total: 72,
      riskLevel: 'medium',
      breakdown: {
        ipPrivacy: 15,
        dnsPrivacy: 12,
        webrtcPrivacy: 13,
        fingerprintResistance: 22,
        browserConfig: 10,
      },
      vulnerabilities: [
        {
          category: 'IP Privacy',
          severity: 'medium',
          title: 'No VPN/Proxy Detected',
          description: 'Your IP is exposed without VPN/proxy shielding.',
          recommendation: 'Enable a reputable VPN before testing again.',
        },
      ],
    },
    fingerprint: {
      combinedHash: 'mock-hash',
      uniquenessScore: 0.74,
      uniquenessPercentage: 74,
      componentScores: {
        canvas: 0.8,
        webgl: 0.7,
        audio: 0.6,
      },
      riskLevel: 'high',
    },
    ip: {
      address: '203.0.113.42',
      version: 'ipv4',
      geolocation: {
        country: 'United States',
        countryCode: 'US',
        city: 'Los Angeles',
        region: 'California',
        latitude: 34.05,
        longitude: -118.25,
        timezone: 'America/Los_Angeles',
      },
      network: {
        asn: 13335,
        asnName: 'Cloudflare',
        organization: 'Cloudflare Inc.',
      },
      privacy: {
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        isRelay: false,
      },
      reputation: {
        score: 20,
        isBlacklisted: false,
      },
    },
    dns: {
      isLeak: false,
      leakType: 'none',
      serverCount: 1,
      servers: [{ ip: '1.1.1.1', country: 'US', isp: 'Cloudflare' }],
    },
    webrtc: {
      isLeak: false,
      localIPs: ['192.168.0.5'],
      publicIP: '203.0.113.42',
      ipv6: false,
    },
    recommendations: ['Enable WebRTC leak protection', 'Harden browser fingerprint defenses'],
  };
}
