"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-controls";
import type { OwnListing } from "./types";

const imagePositions = [1, 2, 3, 4, 5] as const;
type ImagePosition = (typeof imagePositions)[number];
type ImageFiles = Partial<Record<ImagePosition, File>>;

export function VehicleListingForm({
  listing,
  canMutate = true,
}: {
  listing?: OwnListing;
  canMutate?: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"registration" | "model">(listing?.identifier.kind ?? "registration");
  const [identifier, setIdentifier] = useState(listing?.identifier.value ?? "");
  const [mileage, setMileage] = useState(listing ? String(listing.mileageMil) : "");
  const [comment, setComment] = useState(listing?.shortComment ?? "");
  const [vat, setVat] = useState(listing?.deductibleVat ?? false);
  const [draftId, setDraftId] = useState(listing?.id);
  const [files, setFiles] = useState<ImageFiles>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [imageProgress, setImageProgress] = useState<Partial<Record<ImagePosition, string>>>({});

  const immutable = listing?.status === "active";
  const terminal = listing?.status === "withdrawn" || listing?.status === "matched";
  const editable = canMutate && !terminal;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === "publish" ? "publish" : "save";
    const mileageMil = Number(mileage);
    if (!Number.isSafeInteger(mileageMil) || mileageMil < 0) {
      setError("Miltal måste vara ett heltal.");
      return;
    }
    setPending(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      let listingId = draftId;
      const body = immutable
        ? { shortComment: comment }
        : {
            identifier: { kind, value: identifier },
            mileageMil,
            shortComment: comment,
            deductibleVat: vat,
          };
      const response = await fetch(
        listingId ? `/api/company/listings/${listingId}` : "/api/company/listings",
        {
          method: listingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const responseBody = (await response.json().catch(() => null)) as { listing?: OwnListing; error?: string } | null;
      if (!response.ok || !responseBody?.listing) throw new Error(responseBody?.error ?? "SAVE_FAILED");
      listingId = responseBody.listing.id;
      setDraftId(listingId);

      for (const position of imagePositions) {
        const file = files[position];
        if (!file) continue;
        setImageProgress((current) => ({ ...current, [position]: "Laddar upp bild…" }));
        const formData = new FormData();
        formData.set("image", file);
        setImageProgress((current) => ({ ...current, [position]: "Kontrollerar registreringsnummer…" }));
        const upload = await fetch(`/api/company/listings/${listingId}/images/${position}`, {
          method: "PUT",
          body: formData,
        });
        if (!upload.ok) {
          const uploadBody = (await upload.json().catch(() => null)) as { error?: string } | null;
          throw new Error(uploadBody?.error ?? "UPLOAD_FAILED");
        }
        const uploadBody = (await upload.json()) as { listing: OwnListing };
        const uploaded = uploadBody.listing.images.find((image) => image.position === position);
        setImageProgress((current) => ({ ...current, [position]: redactionLabel(uploaded?.plateRedactionStatus) }));
      }

      if (action === "publish") {
        const publish = await fetch(`/api/company/listings/${listingId}/publish`, { method: "POST" });
        if (!publish.ok) {
          const publishBody = (await publish.json().catch(() => null)) as { error?: string } | null;
          throw new Error(publishBody?.error ?? "PUBLISH_FAILED");
        }
      }

      setFiles({});
      if (!listing || action === "publish") {
        router.push(`/app/bilar/${listingId}`);
      }
      router.refresh();
      setSuccess(action === "publish" ? "Bilen är publicerad." : "Ändringarna är sparade.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN";
      setError(errorMessage(code));
    } finally {
      setPending(false);
    }
  }

  async function removeImage(position: ImagePosition) {
    if (!listing || listing.status !== "draft" || !editable) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/company/listings/${listing.id}/images/${position}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Bilden kunde inte tas bort.");
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    if (!listing || listing.status !== "active" || !editable) return;
    if (!window.confirm("Dra tillbaka bilen? Den kan inte återaktiveras.")) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/company/listings/${listing.id}/withdraw`, { method: "POST" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Bilen kunde inte dras tillbaka.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-7">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      {success ? <FormMessage type="success">{success}</FormMessage> : null}

      <fieldset disabled={!editable || immutable}>
        <legend className="font-semibold">Regnr eller modell</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["registration", "model"] as const).map((value) => (
            <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-semibold ${kind === value ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              {value === "registration" ? "Registreringsnummer" : "Modell"}
            </label>
          ))}
        </div>
        <input aria-label={kind === "registration" ? "Registreringsnummer" : "Modell"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={kind === "registration" ? 16 : 160} placeholder={kind === "registration" ? "ABC123" : "BMW M340i xDrive 2022"} className={inputClassName} required />
      </fieldset>

      <label className="block font-semibold">Miltal <span className="font-normal text-[var(--muted)]">(mil)</span>
        <input type="number" inputMode="numeric" min={0} max={200000} step={1} value={mileage} onChange={(event) => setMileage(event.target.value)} disabled={!editable || immutable} placeholder="6430" className={inputClassName} required />
      </label>

      <label className="block font-semibold">Kommentar
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={!editable} maxLength={500} rows={4} placeholder="Svensksåld. M-sport. HUD. Några mindre märken." className={`${inputClassName} resize-y`} required />
        <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">{comment.length}/500</span>
      </label>

      <fieldset disabled={!editable || immutable}>
        <legend className="font-semibold">Avdragbar moms</legend>
        <div className="mt-2 flex gap-3">
          {[true, false].map((value) => <label key={String(value)} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 font-semibold ${vat === value ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]" : "border-[var(--border)]"}`}><input type="radio" checked={vat === value} onChange={() => setVat(value)} className="sr-only" />{value ? "Ja" : "Nej"}</label>)}
        </div>
      </fieldset>

      <fieldset disabled={!editable}>
        <legend className="font-semibold">Bilder <span className="font-normal text-[var(--muted)]">— minst 3, högst 5 vid publicering</span></legend>
        <p className="mt-2 text-sm font-medium text-[var(--primary)]">{new Set([...listing?.images.map((image) => image.position) ?? [], ...Object.keys(files).map(Number)]).size} av 5 bilder uppladdade eller valda</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {imagePositions.map((position) => {
            const existing = listing?.images.find((image) => image.position === position);
            const file = files[position];
            return <div key={position} className="overflow-hidden rounded-xl border border-[var(--border)] bg-slate-50">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                {file ? <p className="break-all px-3 text-center text-sm font-medium">{file.name}</p> : existing ? (
                  // Image is served by a tenant-authorized private route.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={existing.url} alt={`Fordonsbild ${position}`} className="h-full w-full object-cover" />
                ) : <span className="text-sm text-[var(--muted)]">Bild {position}</span>}
              </div>
              <div className="space-y-2 p-3">
                {editable ? <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold hover:border-slate-400">{existing ? "Byt bild" : "Välj bild"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) setFiles((current) => ({ ...current, [position]: selected })); }} /></label> : null}
                {existing && listing?.status === "draft" && editable ? <button type="button" onClick={() => void removeImage(position)} className="min-h-11 w-full text-sm font-semibold text-[var(--danger)]">Ta bort</button> : null}
                {(imageProgress[position] || existing) ? <p className="text-xs font-medium text-[var(--muted)]">{imageProgress[position] ?? redactionLabel(existing?.plateRedactionStatus)}</p> : null}
              </div>
            </div>;
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">JPEG, PNG eller WebP. Högst 10 MB per bild.</p>
      </fieldset>

      {editable ? <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-end">
        {listing?.status === "active" ? <button type="button" onClick={() => void withdraw()} disabled={pending} className="inline-flex min-h-11 items-center justify-center px-4 font-semibold text-[var(--danger)]">Dra tillbaka</button> : null}
        <button type="submit" value="save" disabled={pending} className={secondaryButtonClassName}>{pending ? "Sparar…" : listing?.status === "active" ? "Spara korrigeringar" : "Spara utkast"}</button>
        {(!listing || listing.status === "draft") ? <button type="submit" value="publish" disabled={pending} className={primaryButtonClassName}>{pending ? "Publicerar…" : "Publicera bil"}</button> : null}
      </div> : <p className="border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">Du har läsbehörighet och kan inte ändra bilen.</p>}
    </form>
  );
}

function errorMessage(code: string) {
  if (code === "IMAGE_COUNT_REQUIRED") return "Minst tre och högst fem giltiga bilder krävs för publicering.";
  if (code === "IMAGE_REDACTION_INCOMPLETE") return "Alla bilder måste vara kontrollerade. Byt bilden eller kontakta administratören om granskning krävs.";
  if (code === "INVALID_IMAGE_TYPE") return "Bilden är inte en giltig JPEG-, PNG- eller WebP-fil.";
  if (code === "INVALID_IMAGE_SIZE") return "Bilden är tom eller större än 10 MB.";
  if (code === "ACTIVE_LISTING_FIELDS_LOCKED") return "Reg/modell, miltal och moms är låsta efter publicering.";
  return "Det gick inte att spara bilen. Kontrollera uppgifterna och försök igen.";
}

function redactionLabel(status?: OwnListing["images"][number]["plateRedactionStatus"]) {
  if (status === "PLATE_REDACTED") return "Registreringsnummer hittades och censurerades";
  if (status === "NO_PLATE_DETECTED") return "Inget registreringsnummer hittades";
  if (status === "REVIEW_REQUIRED") return "Kontrollen är osäker – granskning krävs";
  if (status === "FAILED") return "Bildkontrollen misslyckades";
  if (status === "PROCESSING") return "Kontrollerar registreringsnummer…";
  return "Registreringsnumret är inte kontrollerat";
}
