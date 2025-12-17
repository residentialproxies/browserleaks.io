import Link from 'next/link';
import { Shield, Globe, Fingerprint, Zap, Sparkles, Activity } from 'lucide-react';

export const dynamic = 'force-static';

export const metadata = {
  title: 'About BrowserLeaks.io | Modern Browser Privacy Lab',
  description:
    'Learn how BrowserLeaks.io delivers production-grade IP, DNS, WebRTC leak testing and fingerprinting analysis built on Next.js 16 and React 19.',
  alternates: { canonical: 'https://browserleaks.io/about' },
};

const pillars = [
  {
    icon: Shield,
    title: 'Clinical Precision',
    body: 'Every test is deterministic and pairs raw values with human-readable risk explanations, so you know exactly what leaked.',
  },
  {
    icon: Globe,
    title: 'Network-First',
    body: 'IP, DNS, and WebRTC paths are probed with multi-source validators and surfaced as structured telemetry for repeatability.',
  },
  {
    icon: Fingerprint,
    title: 'Full Surface',
    body: 'Canvas, WebGL, Fonts, and hardware hints are consolidated into a single fingerprint entropy score with spoofing indicators.',
  },
  {
    icon: Zap,
    title: 'Performance',
    body: 'Next.js 16 + React 19, aggressive chunking, and Cloudflare edge delivery keep scans sub-second on modern devices.',
  },
];

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-16">
      <div className="absolute inset-0 bg-lab-grid opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="mx-auto max-w-5xl space-y-12 relative">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 text-cyan-200 text-sm">
            <Sparkles className="h-4 w-4" />
            Built for production privacy testing
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-50 tracking-tight">About BrowserLeaks.io</h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
            BrowserLeaks.io is a modern privacy lab engineered to replace brittle legacy leak sites. We combine deterministic IP,
            DNS, WebRTC checks with rich fingerprint analysis and a consistent UI shell so both security teams and everyday users
            can validate their browser posture in seconds.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="lab-panel border border-slate-800/70 bg-slate-900/60 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        <section className="lab-panel border border-slate-800/70 bg-slate-900/70 p-8 space-y-4">
          <h2 className="text-2xl font-semibold text-slate-50">Whatʼs included today</h2>
          <ul className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> IP, DNS, WebRTC leak tests with shareable reports</li>
            <li className="flex items-center gap-2"><Activity className="h-4 w-4 text-amber-300" /> Live audit log stream & telemetry snapshots</li>
            <li className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-emerald-300" /> Fingerprint labs: Canvas, WebGL, Fonts, Client Rects</li>
            <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-300" /> Hardware labs: GPU, Audio, Battery, Motion sensors</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-primary">
              Start Full Scan
            </Link>
            <Link href="/tests/ip-leak" className="btn-secondary">
              Run IP Leak Test
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
