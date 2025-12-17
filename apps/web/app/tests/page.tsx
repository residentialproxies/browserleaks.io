import Link from 'next/link';
import { Activity, Globe, Shield, Zap } from 'lucide-react';

export const dynamic = 'force-static';

const tests = [
  {
    title: 'IP Leak Test',
    href: '/tests/ip-leak',
    icon: Globe,
    summary: 'Detect public IP, ASN, reputation and proxy/VPN flags.',
    tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    title: 'DNS Leak Test',
    href: '/tests/dns-leak',
    icon: Shield,
    summary: 'Validate resolver path, EDNS country hints, and DoH/DoT.',
    tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  },
  {
    title: 'WebRTC Leak Test',
    href: '/tests/webrtc-leak',
    icon: Activity,
    summary: 'Surface local/public candidates, NAT type, and mDNS leaks.',
    tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    title: 'Browser Fingerprint',
    href: '/tests/browser-fingerprint',
    icon: Zap,
    summary: 'Canvas, WebGL, Fonts, Audio entropy and spoofing signals.',
    tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  },
];

export const metadata = {
  title: 'Browser Privacy Tests | BrowserLeaks.io',
  description: 'Run IP, DNS, WebRTC, and fingerprint leak tests from one hub.',
  alternates: { canonical: 'https://browserleaks.io/tests' },
};

export default function TestsIndexPage() {
  return (
    <div className="relative px-4 sm:px-6 lg:px-8 py-16">
      <div className="absolute inset-0 bg-lab-grid opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="mx-auto max-w-5xl space-y-10 relative">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Test Hub</p>
          <h1 className="text-4xl font-bold text-slate-50">Privacy Leak Tests</h1>
          <p className="text-slate-400 max-w-3xl">
            Choose a lab to validate network exposure, fingerprint uniqueness, and real-time communication leaks.
            All tests are client-side and shareable.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map(({ title, href, icon: Icon, summary, tone }) => (
            <Link
              key={href}
              href={href}
              className={`lab-panel border bg-slate-900/70 p-6 flex flex-col gap-3 no-underline ${tone}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-slate-900/60 border border-slate-800 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                  <p className="text-sm text-slate-400">{summary}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-cyan-200 flex items-center gap-2">
                Run test <span aria-hidden>↗</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
