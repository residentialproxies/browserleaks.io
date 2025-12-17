'use client';

import { useCallback, useMemo, useState } from 'react';

export type ScanStep = 'ip' | 'dns' | 'webrtc';
export type ScanStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScanProgress {
  step: ScanStep;
  status: ScanStatus;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface FullScanResult {
  ip?: any;
  dns?: any;
  webrtc?: any;
  startedAt: number;
  finishedAt?: number;
  shareUrl?: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .replace(/\/+$/, '')
  .replace(/\/v1$/, '');
const API_V1 = `${API_BASE}/v1`;

export function useFullScan() {
  const [progress, setProgress] = useState<Record<ScanStep, ScanProgress>>({
    ip: { step: 'ip', status: 'idle' },
    dns: { step: 'dns', status: 'idle' },
    webrtc: { step: 'webrtc', status: 'idle' },
  });
  const [result, setResult] = useState<FullScanResult | null>(null);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => {
    setProgress({
      ip: { step: 'ip', status: 'idle' },
      dns: { step: 'dns', status: 'idle' },
      webrtc: { step: 'webrtc', status: 'idle' },
    });
    setResult(null);
  }, []);

  const runStep = useCallback(async (step: ScanStep) => {
    setProgress((prev) => ({
      ...prev,
      [step]: { step, status: 'running', startedAt: Date.now() },
    }));

    try {
      let res: Response;
      if (step === 'ip') {
        res = await fetch(`${API_V1}/detect/ip`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } else if (step === 'dns') {
        res = await fetch(`${API_V1}/detect/dns-leak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } else {
        res = await fetch(`${API_V1}/detect/webrtc-leak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }

      if (!res.ok) {
        throw new Error(`${step.toUpperCase()} scan failed (${res.status})`);
      }

      const payload = await res.json();
      const data = payload.data ?? payload;

      setProgress((prev) => ({
        ...prev,
        [step]: {
          ...prev[step],
          status: 'success',
          finishedAt: Date.now(),
        },
      }));

      setResult((prev) => ({
        ...(prev || { startedAt: Date.now() }),
        [step]: data,
      }));

      return data;
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        [step]: {
          ...prev[step],
          status: 'error',
          finishedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
      throw error;
    }
  }, []);

  const runFullScan = useCallback(async () => {
    reset();
    setRunning(true);
    const startedAt = Date.now();
    const draft: FullScanResult = { startedAt };

    try {
      draft.ip = await runStep('ip');
      draft.dns = await runStep('dns');
      draft.webrtc = await runStep('webrtc');
      draft.finishedAt = Date.now();

      // Best-effort share link
      try {
        const shareRes = await fetch(`${API_V1}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scan: {
              id: `scan-${startedAt}`,
              timestamp: new Date(startedAt).toISOString(),
              privacyScore: {
                total: 0,
                riskLevel: 'medium',
                breakdown: {
                  ipPrivacy: 0,
                  dnsPrivacy: 0,
                  webrtcPrivacy: 0,
                  fingerprintResistance: 0,
                  browserConfig: 0,
                },
              },
              ip: draft.ip?.ip ? { address: draft.ip.ip, country: draft.ip.geo?.country, city: draft.ip.geo?.city } : {},
              dns: draft.dns ? { isLeak: draft.dns.isLeak, leakType: draft.dns.leakType } : {},
              webrtc: draft.webrtc ? { isLeak: draft.webrtc.isLeak } : {},
              recommendations: draft.dns?.recommendations || [],
            },
          }),
        });
        if (shareRes.ok) {
          const shareData = await shareRes.json();
          draft.shareUrl = shareData.data?.url;
        }
      } catch (error) {
        console.warn('Share creation skipped', error);
      }

      setResult(draft);
      persistLocalHistory(draft);
      return draft;
    } finally {
      setRunning(false);
    }
  }, [reset, runStep]);

  const persistLocalHistory = (scan: FullScanResult) => {
    try {
      const existingRaw = localStorage.getItem('bl-scan-history');
      const existing: FullScanResult[] = existingRaw ? JSON.parse(existingRaw) : [];
      const next = [scan, ...existing].slice(0, 20);
      localStorage.setItem('bl-scan-history', JSON.stringify(next));
    } catch (error) {
      console.warn('History persistence failed', error);
    }
  };

  const overallStatus = useMemo<ScanStatus>(() => {
    if (running) return 'running';
    const steps: ScanStep[] = ['ip', 'dns', 'webrtc'];
    if (steps.some((s) => progress[s].status === 'error')) return 'error';
    if (steps.every((s) => progress[s].status === 'success')) return 'success';
    return 'idle';
  }, [progress, running]);

  return {
    runFullScan,
    progress,
    result,
    running,
    reset,
    overallStatus,
  };
}
