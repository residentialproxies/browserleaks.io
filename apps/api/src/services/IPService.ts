import { IPInfoClient } from '../clients/IPInfoClient';
import type { IPLeakResult } from '@browserleaks/types';
import type { Request } from 'express';
import { log } from '../middleware/logger';

export class IPService {
  private ipinfoClient: IPInfoClient;

  constructor() {
    this.ipinfoClient = new IPInfoClient();
  }

  async detect(ip?: string): Promise<IPLeakResult> {
    try {
      // Get IP information from IPInfo
      const result = await this.ipinfoClient.lookup(ip);

      // Additional processing can be added here
      // - Check against blacklists
      // - Enhance with additional data sources
      // - Cache results

      return result;
    } catch (error) {
      log.error('IP detection error', { error });
      throw error;
    }
  }

  /**
   * Extract client IP from request headers
   */
  getClientIP(req: Request): string {
    const cfIp = req.headers['cf-connecting-ip'];
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof cfIp === 'string') return cfIp;
    if (Array.isArray(cfIp)) return cfIp[0];

    if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
    if (Array.isArray(forwardedFor)) return forwardedFor[0];

    if (typeof realIp === 'string') return realIp;
    if (Array.isArray(realIp)) return realIp[0];

    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
