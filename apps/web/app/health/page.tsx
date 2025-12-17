export const dynamic = 'force-static';

export default function HealthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Status</p>
        <h1 className="text-3xl font-bold">OK</h1>
        <p className="text-xs text-slate-500">BrowserLeaks Pages build is healthy.</p>
      </div>
    </div>
  );
}
