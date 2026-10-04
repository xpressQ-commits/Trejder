"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CarFront, Plus, Trash2 } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/form-controls";
import { identifierLabel, listingStatusLabel, type ListingStatus, type OwnListing } from "./types";

type Filter = "active" | "draft" | "finished";

export function OwnListings({ canMutate, initialListings }: { canMutate: boolean; initialListings: OwnListing[] }) {
  const [listings, setListings] = useState<OwnListing[]>(initialListings);
  const [filter, setFilter] = useState<Filter>("active");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function removeDraft(listing: OwnListing) {
    if (!window.confirm(`Ta bort utkastet ${identifierLabel(listing.identifier)} permanent?`)) return;
    setDeletingId(listing.id);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/company/listings/${listing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("DELETE_DRAFT_FAILED");
      setListings((current) => current.filter((item) => item.id !== listing.id));
    } catch {
      setDeleteError("Utkastet kunde inte tas bort. Försök igen.");
    } finally {
      setDeletingId(null);
    }
  }

  const visible = listings.filter((listing) => filter === "finished" ? listing.status === "withdrawn" || listing.status === "matched" : listing.status === filter);
  return <>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[var(--primary)]">Företagets bilar</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Bilar</h1><p className="mt-2 text-[var(--muted)]">Endast bilar som tillhör det aktiva företaget.</p></div>{canMutate ? <Link href="/app/bilar/ny" className={primaryButtonClassName}><Plus aria-hidden="true" className="mr-2" size={18} />Lägg upp bil</Link> : null}</div>
    <div className="mt-7 flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist" aria-label="Filtrera bilar">{([['active','Aktiva'],['draft','Utkast'],['finished','Avslutade']] as const).map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`min-h-11 border-b-2 px-4 font-semibold ${filter === value ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>{label}</button>)}</div>
    {deleteError ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{deleteError}</p> : null}
    {visible.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-9 text-center"><CarFront aria-hidden="true" className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">Inga bilar här ännu</p></div> : <ul className="mt-5 grid gap-4 lg:grid-cols-2">{visible.map((listing) => <ListingCard key={listing.id} listing={listing} canDelete={canMutate && listing.status === "draft"} deleting={deletingId === listing.id} onDelete={() => void removeDraft(listing)} />)}</ul>}
  </>;
}

function ListingCard({ listing, canDelete, deleting, onDelete }: { listing: OwnListing; canDelete: boolean; deleting: boolean; onDelete: () => void }) {
  const cover = listing.images.find((image) => image.position === 1)?.url;
  return <li className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white transition-shadow hover:shadow-md"><Link href={`/app/bilar/${listing.id}`} className="grid min-h-32 grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr]"><div className="relative bg-slate-100">{cover ? <Image src={cover} alt="" fill unoptimized className="object-cover" /> : <CarFront aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-1/2 text-slate-400" />}</div><div className="min-w-0 p-4"><div className="flex items-start justify-between gap-2"><h2 className="truncate text-lg font-semibold">{identifierLabel(listing.identifier)}</h2><Status status={listing.status} /></div><p className="mt-2 text-sm text-[var(--muted)]">{listing.modelYear ? `${listing.modelYear} · ` : ""}{new Intl.NumberFormat("sv-SE").format(listing.mileageMil)} mil</p><p className="mt-1 text-sm">{listing.deductibleVat ? "Avdragbar moms" : "Ej avdragbar moms"}</p></div></Link>{canDelete ? <div className="border-t border-[var(--border)] p-3"><button type="button" disabled={deleting} onClick={onDelete} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-60"><Trash2 aria-hidden="true" size={17} />{deleting ? "Tar bort…" : "Ta bort utkast"}</button></div> : null}</li>;
}

export function Status({ status }: { status: ListingStatus }) { return <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{listingStatusLabel[status]}</span>; }
