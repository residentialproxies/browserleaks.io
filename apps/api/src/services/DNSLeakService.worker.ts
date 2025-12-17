/**
 * DNS Leak Service (Worker Version)
 *
 * Uses fetch API instead of axios for Worker compatibility.
 * Tests DNS leaks using ip-api.com and SurfShark services.
 */

import type { DNSLeakResult } from '@browserleaks/types';
import type { Env } from '../types/env';

export class DNSLeakService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generate random string for unique subdomain
   */
  private generateRandomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate 32-character unique string for ip-api DNS leak test
   */
  private generate32DigitString(): string {
    const unixTime = Date.now().toString();
    const fixedString = 'browserleaks';
    const randomString = this.generateRandomString(8);
    return unixTime + fixedString + randomString;
  }

  /**
   * Generate 14-character unique string for SurfShark DNS leak test
   */
  private generate14DigitString(): string {
    const fixedString = 'bl32';
    const randomString = this.generateRandomString(9);
    return fixedString + randomString;
  }

  /**
   * Test DNS leak using ip-api.com EDNS service
   */
  private async testIpApi(): Promise<{
    ip: string;
    country: string;
    countryCode: string;
    isp: string;
  }> {
    const urlString = this.generate32DigitString();
    const url = `https://${urlString}.edns.ip-api.com/json`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BrowserLeaks/2.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        dns?: { ip?: string; geo?: string; country?: string };
      };

      if (data.dns?.ip && data.dns?.geo) {
        const geoSplit = data.dns.geo.split(' - ');
        return {
          ip: data.dns.ip,
          country: geoSplit[0] || 'Unknown',
          countryCode: data.dns.country || 'XX',
          isp: geoSplit[1] || 'Unknown',
        };
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      console.warn('IP-API DNS leak test error:', error);
      throw error;
    }
  }

  /**
   * Test DNS leak using SurfShark DNS service
   */
  private async testSurfShark(): Promise<{
    ip: string;
    country: string;
    countryCode: string;
    isp: string;
  }> {
    const urlString = this.generate14DigitString();
    const url = `https://${urlString}.ipv4.surfsharkdns.com`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BrowserLeaks/2.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as Record<
        string,
        { IP?: string; Country?: string; CountryCode?: string; ISP?: string }
      >;

      // Get first key from response
      const firstKey = Object.keys(data)[0];
      const entry = data[firstKey];

      if (entry?.IP && entry?.CountryCode) {
        return {
          ip: entry.IP,
          country: entry.Country || 'Unknown',
          countryCode: entry.CountryCode,
          isp: entry.ISP || 'Unknown',
        };
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      console.warn('SurfShark DNS leak test error:', error);
      throw error;
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Run comprehensive DNS leak test
   */
  async detect(userIp: string, userCountry: string): Promise<DNSLeakResult> {
    const testId = `test_${Date.now()}_${this.generateRandomString(8)}`;
    const servers: DNSLeakResult['servers'] = [];
    const risks: DNSLeakResult['risks'] = [];
    const recommendations: string[] = [];

    try {
      // Run multiple tests with delays to detect DNS servers
      const tests = [
        { name: 'Test 1', fn: () => this.testIpApi(), delay: 100 },
        { name: 'Test 2', fn: () => this.testIpApi(), delay: 500 },
        { name: 'Test 3', fn: () => this.testSurfShark(), delay: 100 },
        { name: 'Test 4', fn: () => this.testSurfShark(), delay: 500 },
      ];

      const results = await Promise.allSettled(
        tests.map(async (test) => {
          await this.delay(test.delay);
          return test.fn();
        })
      );

      // Process results
      const uniqueServers = new Map<string, (typeof servers)[0]>();

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          const key = `${data.ip}-${data.countryCode}`;

          if (!uniqueServers.has(key)) {
            uniqueServers.set(key, {
              ip: data.ip,
              country: data.country,
              countryCode: data.countryCode,
              isp: data.isp,
              isISP: true,
            });
          }
        }
      });

      servers.push(...uniqueServers.values());

      // Analyze leak status
      const isLeak = servers.some((server) => server.countryCode !== userCountry);

      let leakType: DNSLeakResult['leakType'] = 'none';
      if (isLeak) {
        const leakedServers = servers.filter((server) => server.countryCode !== userCountry);
        leakType = leakedServers.length === servers.length ? 'full' : 'partial';
      }

      // Add risks if leak detected
      if (isLeak) {
        risks.push({
          severity: leakType === 'full' ? 'critical' : 'high',
          title: 'DNS Leak Detected',
          description: `Your DNS queries are being routed through servers in ${servers
            .filter((s) => s.countryCode !== userCountry)
            .map((s) => s.country)
            .join(', ')}, which may expose your browsing activity.`,
        });

        recommendations.push(
          'Use a VPN with built-in DNS leak protection',
          'Configure custom DNS servers (e.g., 1.1.1.1, 8.8.8.8)',
          'Enable DNS over HTTPS (DoH) or DNS over TLS (DoT) in your browser'
        );
      } else if (servers.length === 0) {
        recommendations.push('Unable to detect DNS servers. Please try again.');
      } else {
        recommendations.push('No DNS leak detected. Your DNS queries are secure.');
      }

      return {
        testId,
        isLeak,
        leakType,
        servers,
        dohEnabled: false,
        dotEnabled: false,
        risks,
        recommendations,
      };
    } catch (error) {
      console.error('DNS leak detection error:', error);
      throw new Error(error instanceof Error ? error.message : 'DNS leak detection failed');
    }
  }
}
