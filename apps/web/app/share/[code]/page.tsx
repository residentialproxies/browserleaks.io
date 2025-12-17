import Link from 'next/link';
import type { SharedScanResponse } from '@browserleaks/types';
import { LabShell } from '@/components/layout/LabShell';
import type { StatusReading } from '@/components/layout/StatusBar';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .replace(/\/+$/, '')
  .replace(/\/v1$/, '');
const API_V1 = `${API_BASE}/v1`;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ShareResult = {
  data?: SharedScanResponse;
  error?: string;
};

async function fetchSharedScan(code: string): Promise<ShareResult> {
  try {
    const response = await fetch(`${API_V1}/share/${code}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      return { error: payload?.error?.message || 'This shared report could not be found.' };
    }

    return { data: payload.data as SharedScanResponse };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to load shared report' };
  }
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');

const riskColor = (level: string) => {
  switch (level) {
    case 'low':
      return 'text-emerald-300';
    case 'medium':
      return 'text-amber-300';
    case 'high':
      return 'text-orange-300';
    case 'critical':
      return 'text-red-300';
    default:
      return 'text-slate-300';
  }
};

const riskBg = (level: string) => {
  switch (level) {
    case 'low':
      return 'bg-emerald-500/15';
    case 'medium':
      return 'bg-amber-500/15';
    case 'high':
      return 'bg-orange-500/15';
    case 'critical':
      return 'bg-red-500/15';
    default:
      return 'bg-slate-700/40';
  }
};

type SharePageParams = { code?: string | string[] };

type SharePageProps = {
  params?: Promise<SharePageParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: SharePageProps) {
  const resolvedParams = params ? await params : undefined;
  const code = Array.isArray(resolvedParams?.code) ? resolvedParams?.code[0] : resolvedParams?.code || '';
  if (!code) {
    return (
      <LabShell statusReadings={[]}>
        <div className="flex items-center justify-center min-h-[420px]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl text-red-300">!</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">Shared report unavailable</h1>
            <p className="text-slate-400">This shared report link is missing a code.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-cyan-300 border border-cyan-500/40 rounded bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
            >
              Run a fresh scan
            </Link>
          </div>
        </div>
      </LabShell>
    );
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://browserleaks.io';
  return {
    title: `Shared Privacy Report ${code} | BrowserLeaks.io`,
    description: 'View a shared BrowserLeaks privacy scan with leak findings, scores, and recommendations.',
    alternates: {
      canonical: `${baseUrl}/share/${code}`,
    },
    openGraph: {
      title: 'BrowserLeaks Shared Privacy Report',
      url: `${baseUrl}/share/${code}`,
      siteName: 'BrowserLeaks.io',
      type: 'article',
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const resolvedParams = params ? await params : undefined;
  const code = Array.isArray(resolvedParams?.code) ? resolvedParams?.code[0] : resolvedParams?.code || '';
  const { data, error } = await fetchSharedScan(code);

  if (!data || error) {
    return (
      <LabShell statusReadings={[]}>
        <div className="flex items-center justify-center min-h-[420px]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl text-red-300">!</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">Shared report unavailable</h1>
            <p className="text-slate-400">
              {error || 'The link may have expired or reached its view limit.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-cyan-300 border border-cyan-500/40 rounded bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
            >
              Run a fresh scan
            </Link>
          </div>
        </div>
      </LabShell>
    );
  }

  const { scan } = data;

  const statusReadings: StatusReading[] = [
    {
      label: 'Score',
      value: scan.privacyScore.total.toString(),
      tone: scan.privacyScore.total >= 70 ? 'active' : 'alert',
    },
    {
      label: 'Risk',
      value: scan.privacyScore.riskLevel.toUpperCase(),
      tone: scan.privacyScore.riskLevel === 'low' ? 'active' : 'alert',
    },
    {
      label: 'Views',
      value: data.viewCount.toString(),
      tone: 'neutral',
    },
  ];

  return (
    <LabShell statusReadings={statusReadings}>
      <div className="space-y-10">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-300 rounded">Shared report</span>
            {data.expiresAt && (
              <span className="text-xs text-slate-500">Expires {formatDate(data.expiresAt)}</span>
            )}
            {data.remainingViews !== null && (
              <span className="text-xs text-slate-500">Views left: {data.remainingViews}</span>
            )}
          </div>
          <h1 className="text-4xl font-light text-slate-100">Privacy Scan Report</h1>
          <p className="mt-2 text-sm text-slate-400">
            Scanned on {formatDate(scan.timestamp)}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">
              Overall Privacy Score
            </p>
            <div className="flex items-center gap-6">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center ${riskBg(scan.privacyScore.riskLevel)}`}>
                <span className="text-5xl font-light text-slate-100">{scan.privacyScore.total}</span>
              </div>
              <div>
                <p className={`text-2xl font-light capitalize ${riskColor(scan.privacyScore.riskLevel)}`}>
                  {scan.privacyScore.riskLevel} Risk
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {scan.privacyScore.total >= 80 && 'Excellent privacy protection'}
                  {scan.privacyScore.total >= 60 && scan.privacyScore.total < 80 && 'Good privacy with room for improvement'}
                  {scan.privacyScore.total >= 40 && scan.privacyScore.total < 60 && 'Privacy needs attention'}
                  {scan.privacyScore.total < 40 && 'Significant privacy concerns'}
                </p>
              </div>
            </div>
          </div>

          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">
              Score Breakdown
            </p>
            <div className="space-y-3">
              <ScoreBar label="IP Privacy" value={scan.privacyScore.breakdown.ipPrivacy} max={20} />
              <ScoreBar label="DNS Privacy" value={scan.privacyScore.breakdown.dnsPrivacy} max={15} />
              <ScoreBar label="WebRTC Privacy" value={scan.privacyScore.breakdown.webrtcPrivacy} max={15} />
              <ScoreBar label="Fingerprint Resistance" value={scan.privacyScore.breakdown.fingerprintResistance} max={30} />
              <ScoreBar label="Browser Config" value={scan.privacyScore.breakdown.browserConfig} max={20} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">IP Detection</p>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">IP Address</span>
                <span className="font-mono text-cyan-200">{scan.ip?.address || 'Hidden'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Location</span>
                <span className="text-slate-200">
                  {scan.ip?.city || 'Unknown'}, {scan.ip?.country || 'Unknown'}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                {scan.ip?.privacy?.isVpn && (
                  <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">VPN</span>
                )}
                {scan.ip?.privacy?.isProxy && (
                  <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">Proxy</span>
                )}
                {scan.ip?.privacy?.isTor && (
                  <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">Tor</span>
                )}
              </div>
            </div>
          </div>

          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">DNS Leak Test</p>
            <div className="text-center py-4">
              {scan.dns?.isLeak ? (
                <>
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="text-red-400 font-medium">DNS Leak Detected</p>
                  <p className="text-xs text-slate-500 mt-1">Type: {scan.dns.leakType}</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-green-400 font-medium">No DNS Leak</p>
                  <p className="text-xs text-slate-500 mt-1">DNS queries are protected</p>
                </>
              )}
            </div>
          </div>

          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">WebRTC Leak Test</p>
            <div className="text-center py-4">
              {scan.webrtc?.isLeak ? (
                <>
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="text-red-400 font-medium">WebRTC Leak Detected</p>
                  <p className="text-xs text-slate-500 mt-1">Real IP may be exposed</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-green-400 font-medium">No WebRTC Leak</p>
                  <p className="text-xs text-slate-500 mt-1">WebRTC is secure</p>
                </>
              )}
            </div>
          </div>
        </div>

        {scan.fingerprint && (
          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">Browser Fingerprint</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400 mb-2">Fingerprint Hash</p>
                <p className="font-mono text-cyan-200 bg-slate-800/50 p-3 rounded break-all">
                  {scan.fingerprint.combinedHash}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Uniqueness Score</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        scan.fingerprint.uniquenessScore > 0.8
                          ? 'bg-red-500'
                          : scan.fingerprint.uniquenessScore > 0.5
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${scan.fingerprint.uniquenessScore * 100}%` }}
                    />
                  </div>
                  <span className="text-xl font-mono text-cyan-300">
                    {Math.round(scan.fingerprint.uniquenessScore * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {scan.fingerprint.uniquenessScore > 0.8 && 'Highly unique - easily trackable'}
                  {scan.fingerprint.uniquenessScore > 0.5 && scan.fingerprint.uniquenessScore <= 0.8 && 'Moderately unique - somewhat trackable'}
                  {scan.fingerprint.uniquenessScore <= 0.5 && 'Low uniqueness - good for privacy'}
                </p>
              </div>
            </div>
          </div>
        )}

        {scan.recommendations && scan.recommendations.length > 0 && (
          <div className="lab-panel p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-500 mb-4">Recommendations</p>
            <ul className="space-y-3">
              {scan.recommendations.map((rec, i) => (
                <li key={rec} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cyan-400 text-xs">{i + 1}</span>
                  </span>
                  <span className="text-slate-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="lab-panel p-8 text-center">
          <h2 className="text-2xl font-light text-slate-100 mb-4">Want to check your own privacy?</h2>
          <p className="text-slate-400 mb-6">Run a free privacy scan to see how your browser compares.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 text-sm font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded hover:bg-cyan-500/20 transition-colors"
          >
            Start your free scan
          </Link>
        </div>
      </div>
    </LabShell>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = Math.round((value / max) * 100);
  const color = percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
