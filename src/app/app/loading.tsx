export default function AppLoading() {
  return <div role="status" className="animate-pulse space-y-4" aria-label="Laddar sida">
    <div className="h-4 w-28 rounded bg-slate-200" />
    <div className="h-9 w-64 rounded bg-slate-200" />
    <div className="h-36 rounded-2xl border border-[var(--border)] bg-white" />
  </div>;
}
