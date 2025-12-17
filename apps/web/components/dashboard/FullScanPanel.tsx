'use client';

import { useFullScan } from '@/hooks/useFullScan';
import { Shield, Loader2, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import Link from 'next/link';

export function FullScanPanel() {
  const { runFullScan, progress, running, result, overallStatus } = useFullScan();

  const steps = [
    { key: 'ip', label: 'IP Leak', href: '/tests/ip-leak' },
    { key: 'dns', label: 'DNS Leak', href: '/tests/dns-leak' },
    { key: 'webrtc', label: 'WebRTC Leak', href: '/tests/webrtc-leak' },
  ] as const;

  const getBadge = (status: typeof progress['ip']['status']) => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (status === 'error') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />;
    return <div className="h-2 w-2 rounded-full bg-slate-500" />;
  };

  return (
    <div className="lab-panel border border-slate-800/70 bg-slate-900/70 p-6 sm:p-8 shadow-cyan-500/10 shadow-lg space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Full Privacy Scan</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-50">One click, all leak checks</h3>
          </div>
        </div>
        <button
          onClick={runFullScan}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {running ? 'Scanning…' : 'Run full scan'}
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <div key={step.key} className="rounded-md border border-slate-800/70 bg-slate-950/60 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">{step.label}</p>
              <Link href={step.href} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open lab ↗</Link>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              {getBadge(progress[step.key as 'ip' | 'dns' | 'webrtc'].status)}
              <span className="text-xs capitalize">{progress[step.key as 'ip' | 'dns' | 'webrtc'].status}</span>
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200 flex flex-wrap items-center gap-3">
          <span className="font-semibold">Completed in {result.finishedAt && result.startedAt ? `${Math.round((result.finishedAt - result.startedAt) / 1000)}s` : '—'}</span>
          <span className="text-slate-400">IP: {result.ip?.ip || 'n/a'}</span>
          <span className="text-slate-400">DNS: {result.dns?.leakType || 'unknown'}</span>
          <span className="text-slate-400">WebRTC: {result.webrtc?.isLeak ? 'leak' : 'sealed'}</span>
          {result.shareUrl && (
            <a href={result.shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
              <Link2 className="h-4 w-4" />
              Share report
            </a>
          )}
        </div>
      )}

      {overallStatus === 'error' && (
        <p className="text-sm text-amber-300">One or more steps failed. Open the labs above to rerun individually.</p>
      )}
    </div>
  );
}
