/**
 * IP Service (Worker Version)
 *
 * Handles IP detection using IPInfo API.
 * Uses fetch API instead of axios for Worker compatibility.
 * Integrates with KV for caching.
 */

import type { IPLeakResult } from '@browserleaks/types';
import type { Env } from '../types/env';

interface IPInfoPrivacy {
  proxy?: boolean;
  vpn?: boolean;
  hosting?: boolean;
  tor?: boolean;
  relay?: boolean;
}

interface IPInfoCompany {
  type?: string;
}

interface IPInfoAbuse {
  score?: number;
}

interface IPInfoResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  timezone?: string;
  postal?: string;
  org?: string;
  privacy?: IPInfoPrivacy;
  company?: IPInfoCompany;
  abuse?: IPInfoAbuse;
}

const CACHE_TTL = 300; // 5 minutes

export class IPService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Detect IP information with caching
   */
  async detect(ip: string): Promise<IPLeakResult> {
    // Try cache first
    const cached = await this.getCached(ip);
    if (cached) {
      return cached;
    }

    // Fetch from IPInfo
    const result = await this.fetchFromIPInfo(ip);

    // Cache the result
    await this.setCache(ip, result);

    return result;
  }

  /**
   * Fetch IP info from IPInfo.io
   */
  private async fetchFromIPInfo(ip?: string): Promise<IPLeakResult> {
    const token = this.env.IPINFO_TOKEN;
    if (!token) {
      throw new Error('IPINFO_TOKEN not configured');
    }

    const url = ip
      ? `https://ipinfo.io/${ip}/json?token=${token}`
      : `https://ipinfo.io/json?token=${token}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BrowserLeaks/2.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`IPInfo API error: ${response.status} ${response.statusText}`);
    }

    const data: IPInfoResponse = await response.json();
    return this.transformResponse(data);
  }

  /**
   * Transform IPInfo response to our format
   */
  private transformResponse(data: IPInfoResponse): IPLeakResult {
    // Parse location
    const [latitude, longitude] = (data.loc || '0,0').split(',').map(Number);

    return {
      ip: data.ip,
      version: data.ip.includes(':') ? 'ipv6' : 'ipv4',
      geo: {
        country: data.country || 'Unknown',
        countryCode: data.country || 'XX',
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        latitude,
        longitude,
        timezone: data.timezone || 'UTC',
        postalCode: data.postal,
      },
      network: {
        isp: data.org || 'Unknown',
        asn: data.org?.match(/AS\d+/)?.[0] || 'Unknown',
        organization: data.org || 'Unknown',
      },
      privacy: {
        isProxy: Boolean(data.privacy?.proxy),
        isVPN: Boolean(data.privacy?.vpn),
        isDatacenter: data.company?.type === 'hosting' || Boolean(data.privacy?.hosting),
        isTor: Boolean(data.privacy?.tor),
        isRelay: Boolean(data.privacy?.relay),
      },
      reputation: {
        score: this.calculateReputationScore(data),
        isBlacklisted: false,
        categories: [],
      },
    };
  }

  /**
   * Calculate reputation score based on privacy flags
   */
  private calculateReputationScore(data: IPInfoResponse): number {
    let score = 100;

    if (data.privacy?.proxy) score -= 20;
    if (data.privacy?.tor) score -= 30;
    if (data.privacy?.hosting) score -= 15;
    if (data.abuse?.score) score -= data.abuse.score * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get cached IP result from KV
   */
  private async getCached(ip: string): Promise<IPLeakResult | null> {
    if (!this.env.CACHE) return null;

    try {
      const key = `ip:${ip}`;
      const cached = await this.env.CACHE.get(key, { type: 'json' });
      return cached as IPLeakResult | null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache IP result in KV
   */
  private async setCache(ip: string, result: IPLeakResult): Promise<void> {
    if (!this.env.CACHE) return;

    try {
      const key = `ip:${ip}`;
      await this.env.CACHE.put(key, JSON.stringify(result), {
        expirationTtl: CACHE_TTL,
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
}
