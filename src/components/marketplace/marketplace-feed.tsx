"use client";

import Image from "next/image";
import Link from "next/link";
import { CarFront, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceListingSummary, MarketplacePage } from "./types";

type VatFilter = "all" | "yes" | "no";

export function MarketplaceFeed({ initialPage }: { initialPage: MarketplacePage }) {
  const [query, setQuery] = useState("");
  const [vat, setVat] = useState<VatFilter>("all");
  const [listings, setListings] = useState<MarketplaceListingSummary[]>(initialPage.listings);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const firstRender = useRef(true);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (vat !== "all") params.set("vat", vat);
    if (cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`/api/marketplace?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const page = (await response.json()) as MarketplacePage;
      setListings((current) => cursor ? [...current, ...page.listings] : page.listings);
      setNextCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, vat]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <>
    <header>
      <p className="text-sm font-semibold text-[var(--success)]">Alla aktiva bilar</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Marknad</h1>
    </header>
    <div className="mt-7 grid gap-3 border-y border-[var(--border)] py-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
      <label className="relative block"><span className="sr-only">Sök bilmodell</span><Search aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-white pr-3 pl-10" placeholder="Sök bilmodell" /></label>
      <label><span className="sr-only">Filtrera på moms</span><select value={vat} onChange={(event) => setVat(event.target.value as VatFilter)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3"><option value="all">Alla momsstatusar</option><option value="yes">Avdragbar moms</option><option value="no">Ej avdragbar moms</option></select></label>
    </div>
    <p className="mt-3 text-sm text-[var(--muted)]">Sortering: senaste först</p>
    {error ? <p role="alert" className="py-10 text-[var(--danger)]">Marknaden kunde inte hämtas. Försök igen.</p> : listings.length === 0 && !loading ? <div className="py-16 text-center"><CarFront aria-hidden="true" className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">Inga bilar matchar just nu</p><p className="mt-1 text-sm text-[var(--muted)]">Ändra sökningen eller kom tillbaka senare.</p></div> : <ul className="mt-6 grid gap-5 md:grid-cols-2">{listings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}</ul>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-[var(--muted)]">Hämtar bilar…</p> : nextCursor ? <div className="pt-8 text-center"><button type="button" onClick={() => void load(nextCursor)} className="min-h-11 rounded-lg border border-[var(--border)] bg-white px-5 font-semibold hover:bg-slate-50">Visa fler</button></div> : null}
  </>;
}

function MarketplaceCard({ listing }: { listing: MarketplaceListingSummary }) {
  const image = [...listing.images].sort((a, b) => a.position - b.position)[0];
  return <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"><Link href={`/app/marknad/${listing.id}`} className="group block"><div className="relative aspect-[16/10] bg-slate-100">{image ? <Image src={image.url} alt="" fill unoptimized sizes="(min-width: 768px) 40vw, 100vw" className="object-cover transition-transform group-hover:scale-[1.01]" /> : null}</div><div className="p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight">{listing.identifier.value}</h2><p className="mt-0.5 text-[var(--muted)]">{listing.modelYear ? `${listing.modelYear} · ` : ""}{formatMileage(listing.mileageMil)} mil</p><p className="mt-4 line-clamp-2 min-h-12 text-sm">{listing.shortComment}</p><div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--border)] pt-3 text-sm"><span className="font-medium">{listing.deductibleVat ? "Avdragbar moms" : "Ej avdragbar moms"}</span><time className="text-[var(--muted)]" dateTime={listing.publishedAt}>{formatPublished(listing.publishedAt)}</time></div></div></Link></li>;
}

export const formatMileage = (mileage: number) => new Intl.NumberFormat("sv-SE").format(mileage);
export function formatPublished(value: string) {
  const date = new Date(value);
  return `Publicerad ${new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(date)}`;
}
