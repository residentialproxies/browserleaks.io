/**
 * API client for browserleaks backend
 */

import type {
  APIResponse,
  DNSLeakResult,
  IPLeakResult,
  PrivacyScore,
  ShareLinkOptions,
  ShareLinkResponse,
  SharedScan,
  SharedScanResponse,
  WebRTCLeakResult,
} from '@browserleaks/types';
import type { NetworkInsightsPayload } from '@/types/network';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const normalizeBaseUrl = (base: string) =>
  base.replace(/\/+$/, '').replace(/\/v1$/, '');

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = normalizeBaseUrl(baseURL);
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<APIResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        cache: options?.cache ?? 'no-store',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error?.code || 'UNKNOWN_ERROR',
            message: data.error?.message || 'An error occurred',
          },
        };
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  async detectIP(ip?: string): Promise<APIResponse<IPLeakResult>> {
    if (ip && typeof ip === 'string') {
      return this.request<IPLeakResult>(`/v1/detect/ip/${encodeURIComponent(ip)}`);
    }
    return this.request<IPLeakResult>('/v1/detect/ip', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async detectDNSLeak(
    userIp?: string,
    userCountry?: string
  ): Promise<APIResponse<DNSLeakResult>> {
    return this.request<DNSLeakResult>('/v1/detect/dns-leak', {
      method: 'POST',
      body: JSON.stringify({
        userIp,
        userCountry,
      }),
    });
  }

  async detectWebRTCLeak(payload: {
    publicIp: string;
    localIPs: string[];
    candidates: Array<{ ip: string; type: string; server: string }>;
  }): Promise<APIResponse<WebRTCLeakResult>> {
    return this.request<WebRTCLeakResult>('/v1/detect/webrtc-leak', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async calculatePrivacyScore(payload: {
    ipLeak?: IPLeakResult | null;
    dnsLeak?: DNSLeakResult | null;
    webrtcLeak?: WebRTCLeakResult | null;
  }): Promise<APIResponse<PrivacyScore>> {
    return this.request<PrivacyScore>('/v1/privacy-score', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getNetworkInsights(): Promise<APIResponse<NetworkInsightsPayload>> {
    return this.request<NetworkInsightsPayload>('/v1/network/insights');
  }

  async getHealth(): Promise<APIResponse<{ status: string }>> {
    return this.request('/health');
  }

  async getShare(code: string): Promise<APIResponse<SharedScanResponse>> {
    return this.request<SharedScanResponse>(`/v1/share/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
  }

  async createShare(payload: { scan: SharedScan; options?: ShareLinkOptions }): Promise<APIResponse<ShareLinkResponse>> {
    return this.request<ShareLinkResponse>('/v1/share', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new APIClient();

export type {
  IPLeakResult,
  DNSLeakResult,
  WebRTCLeakResult,
  APIResponse,
  PrivacyScore,
  SharedScanResponse,
  ShareLinkResponse,
  SharedScan,
  ShareLinkOptions,
};
