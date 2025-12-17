import { config } from '../config';
import { log } from '../middleware/logger';

interface JA3Response {
  ja3_hash: string;
  user_agent: string;
  asn?: string;
  ciphers?: string;
}

export class CloudflareWorkerClient {
  async fetchJA3(): Promise<JA3Response> {
    if (!config.CF_WORKER_JA3_URL) {
      return this.getFallbackJA3();
    }

    try {
      const response = await fetch(config.CF_WORKER_JA3_URL, {
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

      return this.getFallbackJA3();
    } catch (error) {
      log.warn('JA3 worker lookup failed, using fallback', { error });
      return this.getFallbackJA3();
    }
  }

  async beaconDNS(scanId: string) {
    if (!config.CF_WORKER_DNS_BEACON_URL) {
      return null;
    }

    const url = new URL(config.CF_WORKER_DNS_BEACON_URL);
    url.searchParams.set('scan_id', scanId);

    try {
      const response = await fetch(url, { headers: { 'cache-control': 'no-store' } });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      log.warn('DNS beacon call failed', { error, scanId });
      return null;
    }

    return null;
  }

  private getFallbackJA3(): JA3Response {
    return {
      ja3_hash: 'faux-ja3-hash-demo',
      user_agent: 'BrowserLeaks Lab Simulator',
      ciphers: '4865-4866-4867-4890-49187',
    };
  }
}
