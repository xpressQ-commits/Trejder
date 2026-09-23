import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const inputClassName = "mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--foreground)] shadow-xs placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--focus)] focus:outline-none";
export const primaryButtonClassName = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-offset-2 disabled:hover:bg-[var(--primary)]";
export const secondaryButtonClassName = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]";

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;
  return <label htmlFor={id} className="block font-medium">{label}<input {...props} id={id} className={inputClassName} />{hint ? <span className="mt-1 block text-sm font-normal text-[var(--muted)]">{hint}</span> : null}</label>;
}

export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = props.id ?? props.name;
  return <label htmlFor={id} className="block font-medium">{label}<select {...props} id={id} className={inputClassName}>{children}</select></label>;
}

export function FormMessage({ type, children }: { type: "error" | "success"; children: ReactNode }) {
  return <p role={type === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-sm ${type === "error" ? "border-red-200 bg-red-50 text-[var(--danger)]" : "border-emerald-200 bg-emerald-50 text-[var(--success)]"}`}>{children}</p>;
}
