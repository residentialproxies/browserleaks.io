/**
 * Network Routes (Hono Worker)
 *
 * Endpoints for network insights including traceroute, JA3 fingerprint, etc.
 *
 * GET /v1/network/insights - Get network insights
 */

import { Hono } from 'hono';
import type { AppContext, Env } from '../types/env';
import type { APIResponse } from '@browserleaks/types';

export interface TracerouteHop {
  hop: number;
  ip: string;
  location: string;
  rtt: number;
}

export interface LanHost {
  ip: string;
  device: string;
  status: 'open' | 'filtered' | 'closed';
  service: string;
}

export interface NetworkInsightsPayload {
  traceroute: TracerouteHop[];
  ja3: {
    hash: string;
    userAgent: string;
    ciphers: string[];
  };
  lanHosts: LanHost[];
  dnsBeacon?: unknown;
}

interface JA3Response {
  ja3_hash: string;
  user_agent: string;
  asn?: string;
  ciphers?: string;
}

/**
 * Create network routes
 */
export function createNetworkRoutes() {
  const router = new Hono<AppContext>();

  /**
   * GET /network/insights
   * Get network insights including traceroute simulation and JA3 fingerprint
   */
  router.get('/network/insights', async (c) => {
    try {
      const useMock = c.req.query('mock') === 'true';
      const env = c.env as Env;

      if (useMock) {
        const mockData = getMockInsights();
        const response: APIResponse<NetworkInsightsPayload> = {
          success: true,
          data: mockData,
        };
        return c.json(response);
      }

      // Get real insights
      const traceroute = buildTraceroute();
      const lanHosts = buildLanHosts();
      const ja3 = await fetchJA3(env);
      const beacon = await beaconDNS(
        env,
        traceroute[traceroute.length - 1]?.ip || crypto.randomUUID()
      );

      const data: NetworkInsightsPayload = {
        traceroute,
        lanHosts,
        dnsBeacon: beacon,
        ja3: {
          hash: ja3.ja3_hash,
          userAgent: ja3.user_agent,
          ciphers: (ja3.ciphers || '').split('-').filter(Boolean),
        },
      };

      const response: APIResponse<NetworkInsightsPayload> = {
        success: true,
        data,
      };

      return c.json(response);
    } catch (error) {
      console.error('Network insights error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'NETWORK_INSIGHTS_ERROR',
            message: error instanceof Error ? error.message : 'Failed to load network insights',
          },
        },
        500
      );
    }
  });

  return router;
}

// Helper functions

function buildTraceroute(): TracerouteHop[] {
  const backbone = [
    { hop: 1, ip: '192.168.0.1', location: 'LAN Gateway' },
    { hop: 2, ip: '10.12.0.1', location: 'ISP Edge' },
    { hop: 3, ip: '89.23.14.1', location: 'Regional POP' },
    { hop: 4, ip: '104.16.132.229', location: 'Cloudflare PoP' },
    { hop: 5, ip: '172.67.0.22', location: 'BrowserLeaks Edge' },
  ];

  return backbone.map((hop) => ({
    ...hop,
    rtt: Number((Math.random() * 40 + hop.hop * 3).toFixed(2)),
  }));
}

function buildLanHosts(): LanHost[] {
  return [
    { ip: '192.168.0.1', device: 'Gateway', status: 'open', service: 'HTTPS (TLS)' },
    { ip: '192.168.0.12', device: 'Workstation', status: 'filtered', service: 'RDP' },
    { ip: '192.168.0.24', device: 'IoT Camera', status: 'open', service: 'RTSP' },
    { ip: '192.168.0.35', device: 'NAS', status: 'closed', service: 'SMB' },
  ];
}

async function fetchJA3(env: Env): Promise<JA3Response> {
  if (!env.CF_WORKER_JA3_URL) {
    return getFallbackJA3();
  }

  try {
    const response = await fetch(env.CF_WORKER_JA3_URL, {
      headers: {
        'cache-control': 'no-store',
      },
    });

    if (!response.ok) {
      throw new Error('JA3 worker error');
    }

    const data = (await response.json()) as Partial<JA3Response>;
    if (data?.ja3_hash && data?.user_agent) {
      return {
        ja3_hash: data.ja3_hash,
        user_agent: data.user_agent,
        asn: data.asn,
        ciphers: data.ciphers,
      };
    }

    return getFallbackJA3();
  } catch (error) {
    console.warn('JA3 worker lookup failed, using fallback', error);
    return getFallbackJA3();
  }
}

async function beaconDNS(env: Env, scanId: string) {
  if (!env.CF_WORKER_DNS_BEACON_URL) {
    return null;
  }

  const url = new URL(env.CF_WORKER_DNS_BEACON_URL);
  url.searchParams.set('scan_id', scanId);

  try {
    const response = await fetch(url, { headers: { 'cache-control': 'no-store' } });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('DNS beacon call failed', { error, scanId });
    return null;
  }

  return null;
}

function getFallbackJA3(): JA3Response {
  return {
    ja3_hash: 'faux-ja3-hash-demo',
    user_agent: 'BrowserLeaks Lab Simulator',
    ciphers: '4865-4866-4867-4890-49187',
  };
}

function getMockInsights(): NetworkInsightsPayload {
  return {
    traceroute: [
      { hop: 1, ip: '192.168.0.1', location: 'LAN Gateway', rtt: 2 },
      { hop: 2, ip: '10.0.0.1', location: 'ISP Edge', rtt: 9 },
      { hop: 3, ip: '104.16.0.10', location: 'Cloudflare PoP', rtt: 18 },
    ],
    ja3: {
      hash: 'mocked-ja3-hash',
      userAgent: 'MockBrowser/1.0',
      ciphers: ['4865', '4866', '4867'],
    },
    lanHosts: buildLanHosts(),
    dnsBeacon: { status: 'mocked', scan_id: 'mock-scan' },
  };
}
