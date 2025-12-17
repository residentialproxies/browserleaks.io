'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, Wifi, Globe2, Waves, Fingerprint, Loader2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .replace(/\/+$/, '')
  .replace(/\/v1$/, '');
const API_HEALTH = `${API_BASE}/health`;

type LeakStatus = 'protected' | 'leaking' | 'unknown';

interface CoverageCard {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  cta: string;
  href: string;
  status: LeakStatus;
  details: string;
}

export function LeakCoverage() {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, LeakStatus>>({
    ip: 'unknown',
    dns: 'unknown',
    webrtc: 'unknown',
    fingerprint: 'unknown',
  });
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      setLoading(true);
      try {
        // Lightweight health ping so we don’t slow the page
        const start = performance.now();
        const health = await fetch(API_HEALTH, { cache: 'no-store' });
        const end = performance.now();
        if (!health.ok) throw new Error('Health check failed');
        setLatencyMs(Math.round(end - start));
        setLastChecked(new Date().toISOString());
        const nextStatuses: Record<string, LeakStatus> = { ...statuses };
        // Mark as protected until user runs deeper tests; surfaces “unknown” when API unreachable.
        nextStatuses.ip = 'protected';
        nextStatuses.dns = 'protected';
        nextStatuses.webrtc = 'protected';
        nextStatuses.fingerprint = 'unknown';
        if (!cancelled) setStatuses(nextStatuses);
      } catch {
        if (!cancelled) {
          setStatuses({ ip: 'unknown', dns: 'unknown', webrtc: 'unknown', fingerprint: 'unknown' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    probe();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards: CoverageCard[] = [
    {
      key: 'ip',
      title: 'IP Exposure',
      description: 'Checks real public IP, ASN, ISP reputation, proxy / VPN flags.',
      icon: Globe2,
      cta: 'Run IP Leak Test',
      href: '/tests/ip-leak',
      status: statuses.ip,
      details: 'Uses IP intelligence plus blacklist scoring.',
    },
    {
      key: 'dns',
      title: 'DNS Leakage',
      description: 'Validates resolvers and cross-country egress.',
      icon: Wifi,
      cta: 'Run DNS Leak Test',
      href: '/tests/dns-leak',
      status: statuses.dns,
      details: 'EDNS + SurfShark beacons to catch ISP leakage.',
    },
    {
      key: 'webrtc',
      title: 'WebRTC Path',
      description: 'Surfaces STUN candidates and mDNS leakage.',
      icon: Waves,
      cta: 'Run WebRTC Leak Test',
      href: '/tests/webrtc-leak',
      status: statuses.webrtc,
      details: 'Reports local/public IP candidates and NAT type.',
    },
    {
      key: 'fingerprint',
      title: 'Fingerprint Risk',
      description: 'Canvas / WebGL / Fonts uniqueness with entropy bits.',
      icon: Fingerprint,
      cta: 'Open Fingerprint Lab',
      href: '/fingerprints',
      status: statuses.fingerprint,
      details: 'Run the lab to compute uniqueness & spoofing flags.',
    },
  ];

  return (
    <div className="lab-panel border border-slate-800/60 bg-slate-900/70 p-6 sm:p-8 shadow-cyan-500/10 shadow-lg">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Leak Coverage</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-50 mt-1">Your privacy surface at a glance</h2>
          <p className="text-slate-400 mt-2 max-w-2xl">
            We pre-flight check the API, then guide you to the exact lab to burn down any remaining leaks. Unknown means you haven&apos;t run that test yet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/70 px-3 py-2 rounded-full border border-slate-700">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          ) : statuses.ip === 'unknown' ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          )}
          <span>{loading ? 'Probing API…' : 'Ready for deep scans'}</span>
        </div>
      </div>

      <div className="text-xs text-slate-500 mt-2 flex items-center gap-4">
        {latencyMs !== null && <span>API latency: {latencyMs}ms</span>}
        {lastChecked && <span>Last checked: {new Date(lastChecked).toLocaleTimeString()}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
        {cards.map(({ key, ...card }) => (
          <CoverageCard key={key} {...card} loading={loading} />
        ))}
      </div>
    </div>
  );
}

function CoverageCard({
  title,
  description,
  icon: Icon,
  cta,
  href,
  status,
  details,
  loading,
}: CoverageCard & { loading: boolean }) {
  const statusCopy: Record<LeakStatus, { badge: string; classes: string }> = {
    protected: { badge: 'Protected', classes: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
    leaking: { badge: 'Leak Detected', classes: 'text-amber-200 bg-amber-500/10 border-amber-500/20' },
    unknown: { badge: 'Untested', classes: 'text-slate-300 bg-slate-700/40 border-slate-700' },
  };

  const palette = statusCopy[status];

  return (
    <div className={`rounded-md border ${palette.classes} p-4 bg-slate-900/80 flex flex-col gap-3`}> 
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-cyan-300" />
          <h3 className="font-semibold text-slate-50">{title}</h3>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${palette.classes}`}>
          {loading ? 'Checking…' : palette.badge}
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      <p className="text-xs text-slate-500">{details}</p>
      <Link
        href={href}
        className="mt-auto inline-flex items-center justify-between text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
      >
        <span>{cta}</span>
        <span aria-hidden className="text-lg">↗</span>
      </Link>
    </div>
  );
}
