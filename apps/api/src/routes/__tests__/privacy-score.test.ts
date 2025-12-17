import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import type { IPLeakResult, DNSLeakResult, WebRTCLeakResult } from '@browserleaks/types';

type PartialIPLeak = Partial<Omit<IPLeakResult, 'geo' | 'network' | 'privacy' | 'reputation'>> & {
  geo?: Partial<IPLeakResult['geo']>;
  network?: Partial<IPLeakResult['network']>;
  privacy?: Partial<IPLeakResult['privacy']>;
  reputation?: Partial<IPLeakResult['reputation']>;
};

const makeIPLeak = (overrides: PartialIPLeak = {}): IPLeakResult => {
  const base: IPLeakResult = {
    ip: '1.1.1.1',
    version: 'ipv4',
    geo: {
      country: 'US',
      countryCode: 'US',
      city: 'Los Angeles',
      region: 'California',
      timezone: 'America/Los_Angeles',
      latitude: 34.0522,
      longitude: -118.2437,
    },
    network: {
      isp: 'Cloudflare',
      asn: '13335',
      organization: 'Cloudflare Inc.',
    },
    privacy: {
      isVPN: true,
      isProxy: false,
      isTor: false,
      isDatacenter: false,
      isRelay: false,
    },
    reputation: {
      score: 85,
      isBlacklisted: false,
      categories: [],
    },
  };

  return {
    ...base,
    ...overrides,
    geo: { ...base.geo, ...(overrides.geo || {}) },
    network: { ...base.network, ...(overrides.network || {}) },
    privacy: { ...base.privacy, ...(overrides.privacy || {}) },
    reputation: { ...base.reputation, ...(overrides.reputation || {}) },
  };
};

const makeDNSLeak = (overrides: Partial<DNSLeakResult> = {}): DNSLeakResult => {
  const base: DNSLeakResult = {
    testId: 'dns-test',
    isLeak: false,
    leakType: 'none',
    servers: [],
    dohEnabled: true,
    dotEnabled: true,
    risks: [],
    recommendations: [],
  };

  return {
    ...base,
    ...overrides,
    servers: overrides.servers ?? base.servers,
    risks: overrides.risks ?? base.risks,
    recommendations: overrides.recommendations ?? base.recommendations,
  };
};

const makeWebRTCLeak = (overrides: Partial<WebRTCLeakResult> = {}): WebRTCLeakResult => {
  const base: WebRTCLeakResult = {
    isLeak: false,
    localIPs: [],
    publicIPs: [],
    natType: 'unknown',
    mdnsLeak: false,
    ipv6Leak: false,
    stunResults: [],
    riskLevel: 'low',
    risks: [],
    recommendations: [],
  };

  return {
    ...base,
    ...overrides,
    stunResults: overrides.stunResults ?? base.stunResults,
    risks: overrides.risks ?? base.risks,
    recommendations: overrides.recommendations ?? base.recommendations,
  };
};

describe('POST /v1/privacy-score', () => {
  it('should return privacy score for valid input', async () => {
    const mockInput = {
      ipLeak: makeIPLeak(),
      dnsLeak: makeDNSLeak(),
      webrtcLeak: makeWebRTCLeak({ natType: 'relay' }),
    };

    const response = await request(app)
      .post('/v1/privacy-score')
      .send(mockInput)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('totalScore');
    expect(response.body.data).toHaveProperty('riskLevel');
    expect(response.body.data).toHaveProperty('breakdown');
    expect(response.body.data).toHaveProperty('vulnerabilities');
    expect(response.body.data).toHaveProperty('timeline');

    // Verify breakdown structure
    expect(response.body.data.breakdown).toHaveProperty('ipPrivacy');
    expect(response.body.data.breakdown).toHaveProperty('dnsPrivacy');
    expect(response.body.data.breakdown).toHaveProperty('webrtcPrivacy');
    expect(response.body.data.breakdown).toHaveProperty('fingerprintResistance');
    expect(response.body.data.breakdown).toHaveProperty('browserConfig');

    // Verify score is reasonable for good privacy setup
    expect(response.body.data.totalScore).toBeGreaterThan(40);
    expect(['low', 'medium', 'high']).toContain(response.body.data.riskLevel);
  });

  it('should handle empty input gracefully', async () => {
    const response = await request(app)
      .post('/v1/privacy-score')
      .send({})
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data.totalScore).toBe(0);
    expect(response.body.data.riskLevel).toBe('critical');
  });

  it('should identify vulnerabilities for poor privacy setup', async () => {
    const mockBadInput = {
      ipLeak: makeIPLeak({
        ip: '203.0.113.1',
        network: { isp: 'Comcast', asn: '7922', organization: 'Comcast Cable' },
        geo: {
          city: 'New York',
          region: 'New York',
          timezone: 'America/New_York',
          latitude: 40.7128,
          longitude: -74.006,
        },
        privacy: { isVPN: false, isProxy: false, isDatacenter: false },
        reputation: { score: 30, isBlacklisted: true, categories: ['spam'] },
      }),
      dnsLeak: makeDNSLeak({
        isLeak: true,
        leakType: 'full',
        servers: [{ ip: '8.8.8.8', country: 'US', countryCode: 'US', isp: 'Google', isISP: true }],
        dohEnabled: false,
        dotEnabled: false,
        risks: [{ severity: 'high', title: 'DNS queries exposed', description: 'Resolvers outside VPN' }],
        recommendations: ['Use VPN with DNS leak protection'],
      }),
      webrtcLeak: makeWebRTCLeak({
        isLeak: true,
        localIPs: ['192.168.1.100'],
        publicIPs: ['203.0.113.1'],
        natType: 'host',
        mdnsLeak: true,
        ipv6Leak: true,
        riskLevel: 'critical',
        risks: [{ severity: 'critical', title: 'All IPs exposed', description: 'WebRTC reveals IPs' }],
        recommendations: ['Disable WebRTC'],
      }),
    };

    const response = await request(app)
      .post('/v1/privacy-score')
      .send(mockBadInput)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.vulnerabilities).toBeInstanceOf(Array);
    expect(response.body.data.vulnerabilities.length).toBeGreaterThan(0);

    // Should have critical vulnerabilities
    const criticalVulns = response.body.data.vulnerabilities.filter(
      (v: { severity: string }) => v.severity === 'critical'
    );
    expect(criticalVulns.length).toBeGreaterThan(0);

    // Should have low score and critical risk
    expect(response.body.data.totalScore).toBeLessThan(20);
    expect(response.body.data.riskLevel).toBe('critical');
  });

  it('should handle partial data (only IP leak)', async () => {
    const mockInput = {
      ipLeak: makeIPLeak({
        geo: {
          city: 'LA',
          region: 'CA',
          latitude: 34,
          longitude: -118,
        },
        reputation: { score: 90 },
      }),
    };

    const response = await request(app)
      .post('/v1/privacy-score')
      .send(mockInput)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.breakdown.ipPrivacy).toBeGreaterThan(0);
    expect(response.body.data.breakdown.dnsPrivacy).toBe(0);
    expect(response.body.data.breakdown.webrtcPrivacy).toBe(0);
  });

  it('should include timeline with current timestamp', async () => {
    const beforeTime = Date.now();

    const response = await request(app)
      .post('/v1/privacy-score')
      .send({})
      .expect(200);

    const afterTime = Date.now();

    expect(response.body.data.timeline).toBeInstanceOf(Array);
    expect(response.body.data.timeline).toHaveLength(1);
    expect(response.body.data.timeline[0]).toHaveProperty('timestamp');
    expect(response.body.data.timeline[0]).toHaveProperty('score');
    expect(response.body.data.timeline[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(response.body.data.timeline[0].timestamp).toBeLessThanOrEqual(afterTime);
    expect(response.body.data.timeline[0].score).toBe(response.body.data.totalScore);
  });

  it('should validate vulnerability structure', async () => {
    const mockInput = {
      ipLeak: makeIPLeak({
        ip: '203.0.113.1',
        geo: {
          city: 'NY',
          region: 'NY',
          timezone: 'America/New_York',
          latitude: 40,
          longitude: -74,
        },
        network: { isp: 'Comcast', asn: '7922', organization: 'Comcast Cable' },
        privacy: { isVPN: false },
        reputation: { score: 80 },
      }),
    };

    const response = await request(app)
      .post('/v1/privacy-score')
      .send(mockInput)
      .expect(200);

    const vulnerabilities = response.body.data.vulnerabilities;
    if (vulnerabilities.length > 0) {
      const vuln = vulnerabilities[0];
      expect(vuln).toHaveProperty('category');
      expect(vuln).toHaveProperty('severity');
      expect(vuln).toHaveProperty('title');
      expect(vuln).toHaveProperty('description');
      expect(vuln).toHaveProperty('recommendation');
      expect(['low', 'medium', 'high', 'critical']).toContain(vuln.severity);
    }
  });

  it('should handle malformed input gracefully', async () => {
    const response = await request(app)
      .post('/v1/privacy-score')
      .send({ invalidField: 'test' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Should still return valid response structure
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  });
});
