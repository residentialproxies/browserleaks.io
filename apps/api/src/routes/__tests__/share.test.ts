import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { SharedScan } from '@browserleaks/types';
import app from '../../app';

const makeScan = (overrides: Partial<SharedScan> = {}): SharedScan => {
  const base: SharedScan = {
    id: 'scan-demo',
    timestamp: new Date().toISOString(),
    privacyScore: {
      total: 68,
      riskLevel: 'medium',
      breakdown: {
        ipPrivacy: 14,
        dnsPrivacy: 12,
        webrtcPrivacy: 12,
        fingerprintResistance: 18,
        browserConfig: 12,
      },
    },
    fingerprint: {
      combinedHash: 'abc123def456',
      uniquenessScore: 0.74,
    },
    ip: {
      address: '198.51.100.10',
      country: 'United States',
      city: 'New York',
      privacy: {
        isVpn: true,
        isProxy: false,
        isTor: false,
      },
    },
    dns: {
      isLeak: false,
      leakType: 'none',
    },
    webrtc: {
      isLeak: false,
    },
    recommendations: ['Enable WebRTC IP handling', 'Keep DNS leak protection on'],
  };

  return {
    ...base,
    ...overrides,
    privacyScore: {
      ...base.privacyScore,
      ...(overrides.privacyScore || {}),
      breakdown: {
        ...base.privacyScore.breakdown,
        ...(overrides.privacyScore?.breakdown || {}),
      },
    },
    ip: overrides.ip ? { ...base.ip, ...overrides.ip } : base.ip,
    dns: overrides.dns ? { ...base.dns, ...overrides.dns } : base.dns,
    webrtc: overrides.webrtc ? { ...base.webrtc, ...overrides.webrtc } : base.webrtc,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Share routes', () => {
  it('creates and fetches a share link', async () => {
    const create = await request(app)
      .post('/v1/share')
      .send({ scan: makeScan(), options: { maxViews: 5 } })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(create.body.success).toBe(true);
    expect(create.body.data.code).toBeDefined();
    expect(create.body.data.url).toContain(create.body.data.code);

    const { code } = create.body.data;

    const fetchShare = await request(app)
      .get(`/v1/share/${code}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(fetchShare.body.success).toBe(true);
    expect(fetchShare.body.data.scan.id).toBe('scan-demo');
    expect(fetchShare.body.data.viewCount).toBe(1);

    const stats = await request(app)
      .get(`/v1/share/${code}/stats`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(stats.body.data.viewCount).toBe(1);
    expect(stats.body.data.maxViews).toBe(5);
  });

  it('honors max view limits', async () => {
    const create = await request(app)
      .post('/v1/share')
      .send({ scan: makeScan({ id: 'max-view' }), options: { maxViews: 1 } })
      .expect(200);

    const code = create.body.data.code as string;

    await request(app).get(`/v1/share/${code}`).expect(200);
    await request(app).get(`/v1/share/${code}`).expect(410);
  });

  it('expires links after configured TTL', async () => {
    const create = await request(app)
      .post('/v1/share')
      .send({ scan: makeScan({ id: 'ttl' }), options: { expiresIn: 1 } })
      .expect(200);

    const code = create.body.data.code as string;
    await sleep(1100);

    const expired = await request(app)
      .get(`/v1/share/${code}`)
      .expect('Content-Type', /json/)
      .expect(410);

    expect(expired.body.error.code).toBe('SHARE_EXPIRED');
  });
});
