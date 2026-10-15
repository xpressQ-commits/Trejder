import { AlertTriangle, FileText } from "lucide-react";
import type { ListingDeviation } from "@/domain/listing-details";
import { VehicleGallery } from "./vehicle-gallery";

const labels: Record<ListingDeviation, string> = {
  WAS_WANTED: "Fordonet har varit efterlyst",
  PRIVATE_IMPORT: "Privatimport",
  MILEAGE_HISTORY_ANOMALY: "Miltalshistoriken innehåller avvikelser",
  REPAIRED: "Fordonet har reparerats",
};

export function DeviationDetails({
  deviations,
  wantedComment,
}: {
  deviations: ListingDeviation[];
  wantedComment: string | null;
}) {
  if (deviations.length === 0) return null;
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle aria-hidden="true" size={17} />
        Avvikelser {deviations.length}
      </summary>
      <div className="absolute top-full right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
        <h2 className="font-semibold">Avvikelser</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {deviations.map((deviation) => (
            <li key={deviation}>
              <p className="font-medium">• {labels[deviation]}</p>
              {deviation === "WAS_WANTED" && wantedComment ? (
                <p className="mt-1 pl-4 text-[var(--muted)]">{wantedComment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function DamageGallery({
  images,
  label,
}: {
  images: Array<{ position: number; url: string }>;
  label: string;
}) {
  if (images.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-semibold">Skadebilder</h2>
      <VehicleGallery images={images} label={`Skada på ${label}`} />
    </section>
  );
}

export function ListingDocuments({
  documents,
}: {
  documents: Array<{ id: string; name: string; url: string }>;
}) {
  if (documents.length === 0) return null;
  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-semibold">Dokument</h2>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {documents.map((document) => (
          <li key={document.id}>
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center gap-3 py-2 font-semibold text-[var(--primary)] hover:underline"
            >
              <FileText aria-hidden="true" size={18} />
              {document.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
