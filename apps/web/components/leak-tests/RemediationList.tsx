'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

export interface RemediationItem {
  title: string;
  detail: string;
  link?: { href: string; label: string };
  severity?: 'info' | 'warn';
}

export function RemediationList({ items }: { items: RemediationItem[] }) {
  if (!items.length) return null;

  return (
    <div className="lab-panel border border-slate-800/60 bg-slate-900/60 p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold text-slate-100">Recommended fixes</p>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 rounded-md border border-slate-800/70 bg-slate-950/40 p-3">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.severity === 'warn' ? 'text-amber-300' : 'text-emerald-300'}`} />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">{item.title}</p>
              <p className="text-sm text-slate-400">{item.detail}</p>
              {item.link && (
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {item.link.label} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
