import { formatRegistrationNumber } from "@/domain/registration-number";

export function RegistrationPlate({ value, label }: { value: string; label: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold text-[var(--muted)]">{label}</h2>
      <div className="mt-3 inline-flex min-h-14 items-center rounded-lg border-2 border-slate-800 bg-white px-5 font-mono text-2xl font-black tracking-[0.14em] text-slate-950 shadow-sm">
        <span aria-hidden="true" className="mr-3 h-9 w-2 rounded-sm bg-[#1558a6]" />
        {formatRegistrationNumber(value)}
      </div>
    </section>
  );
}
