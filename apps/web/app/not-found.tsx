import Link from 'next/link';
import { ShieldAlert, Compass, ArrowLeft, Fingerprint, Network } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full space-y-8">
        <div className="lab-panel border border-slate-800/70 bg-slate-900/60 p-8 shadow-2xl shadow-cyan-500/10">
          <div className="flex items-center gap-3 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
            <p className="text-sm font-semibold tracking-wide uppercase">Route not found</p>
          </div>

          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-50">
            We couldn&apos;t locate that lab.
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed">
            The URL you followed isn&apos;t part of the BrowserLeaks lab map. Choose a destination below to run a leak test or go back to the main console.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/tests/ip-leak"
              className="group lab-panel border border-cyan-500/30 bg-slate-900/70 px-4 py-3 flex items-center justify-between hover:border-cyan-400 transition"
            >
              <div className="flex items-center gap-3">
                <Network className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="font-semibold text-slate-100">IP Leak Test</p>
                  <p className="text-xs text-slate-400">Detect exposed addresses</p>
                </div>
              </div>
              <span className="text-cyan-300 group-hover:translate-x-1 transition-transform">↗</span>
            </Link>

            <Link
              href="/tests/dns-leak"
              className="group lab-panel border border-amber-500/30 bg-slate-900/70 px-4 py-3 flex items-center justify-between hover:border-amber-400 transition"
            >
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-amber-300" />
                <div>
                  <p className="font-semibold text-slate-100">DNS Leak Test</p>
                  <p className="text-xs text-slate-400">Check resolver exposure</p>
                </div>
              </div>
              <span className="text-amber-300 group-hover:translate-x-1 transition-transform">↗</span>
            </Link>

            <Link
              href="/fingerprints"
              className="group lab-panel border border-emerald-500/30 bg-slate-900/70 px-4 py-3 flex items-center justify-between hover:border-emerald-400 transition"
            >
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-semibold text-slate-100">Fingerprint Lab</p>
                  <p className="text-xs text-slate-400">Canvas · WebGL · Fonts</p>
                </div>
              </div>
              <span className="text-emerald-300 group-hover:translate-x-1 transition-transform">↗</span>
            </Link>

            <Link
              href="/"
              className="group lab-panel border border-slate-700 bg-slate-900/70 px-4 py-3 flex items-center justify-between hover:border-slate-500 transition"
            >
              <div className="flex items-center gap-3">
                <ArrowLeft className="h-5 w-5 text-slate-200" />
                <div>
                  <p className="font-semibold text-slate-100">Back to Dashboard</p>
                  <p className="text-xs text-slate-400">Home console</p>
                </div>
              </div>
              <span className="text-slate-300 group-hover:translate-x-1 transition-transform">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
