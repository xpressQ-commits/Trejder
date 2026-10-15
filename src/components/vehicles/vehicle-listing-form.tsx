"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-controls";
import type { OwnListing } from "./types";
import type { EquipmentKey } from "@/domain/equipment";
import {
  listingDeviationKeys,
  type ListingDeviation,
} from "@/domain/listing-details";
import { EquipmentSelector } from "./equipment-selector";

const imagePositions = [1, 2, 3, 4, 5] as const;
type ImagePosition = (typeof imagePositions)[number];
type PendingAction = "save" | "publish";
type PublishProgress = { percent: number; title: string; detail: string };
type LocationSuggestion = {
  postalCode: string;
  locality: string;
  county: string;
};

export function VehicleListingForm({
  listing,
  canMutate = true,
  allowUnlimitedPublication = false,
}: {
  listing?: OwnListing;
  canMutate?: boolean;
  allowUnlimitedPublication?: boolean;
}) {
  const router = useRouter();
  const [model, setModel] = useState(
    listing?.identifier.kind === "model" ? listing.identifier.value : "",
  );
  const [registrationNumber, setRegistrationNumber] = useState(
    listing?.registrationNumber ?? "",
  );
  const [showRegistrationNumber, setShowRegistrationNumber] = useState(
    listing?.showRegistrationNumber ?? false,
  );
  const [modelYear, setModelYear] = useState(
    listing?.modelYear ? String(listing.modelYear) : "",
  );
  const [mileage, setMileage] = useState(
    listing ? String(listing.mileageMil) : "",
  );
  const [equipment, setEquipment] = useState<EquipmentKey[]>(
    listing?.equipment ?? [],
  );
  const [otherEquipment, setOtherEquipment] = useState(
    listing?.otherEquipment ?? "",
  );
  const [comment, setComment] = useState(listing?.shortComment ?? "");
  const [postalCode, setPostalCode] = useState(listing?.postalCode ?? "");
  const [locality, setLocality] = useState(listing?.locality ?? "");
  const [county, setCounty] = useState(listing?.county ?? "");
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [locationPending, setLocationPending] = useState(false);
  const [deviations, setDeviations] = useState<ListingDeviation[]>(
    listing?.deviations ?? [],
  );
  const [wantedComment, setWantedComment] = useState(
    listing?.wantedComment ?? "",
  );
  const [vat, setVat] = useState(listing?.deductibleVat ?? false);
  const [publicationHours, setPublicationHours] = useState<number | null>(
    listing?.publicationHours ?? 48,
  );
  const [draftId, setDraftId] = useState(listing?.id);
  const [files, setFiles] = useState<File[]>([]);
  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [currentListing, setCurrentListing] = useState(listing);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [imageProgress, setImageProgress] = useState<
    Partial<Record<ImagePosition, string>>
  >({});
  const [publishProgress, setPublishProgress] = useState<PublishProgress>();

  const immutable =
    currentListing?.status === "active" ||
    currentListing?.status === "inactive";
  const terminal =
    currentListing?.status === "withdrawn" ||
    currentListing?.status === "matched";
  const editable = canMutate && !terminal;
  const pending = pendingAction !== undefined;
  const selectedPositions = imagePositions
    .filter(
      (position) =>
        !currentListing?.images.some((image) => image.position === position),
    )
    .slice(0, files.length);
  const selectedDamagePositions = imagePositions
    .filter(
      (position) =>
        !currentListing?.damageImages.some(
          (image) => image.position === position,
        ),
    )
    .slice(0, damageFiles.length);

  useEffect(() => {
    const normalized = postalCode.replace(/\s+/g, "");
    if (!/^[1-9][0-9]{4}$/.test(normalized)) {
      return;
    }
    if (
      normalized === listing?.postalCode &&
      locality === listing.locality &&
      county === listing.county
    ) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLocationPending(true);
      try {
        const response = await fetch(`/api/postcodes/${normalized}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as {
          suggestions?: LocationSuggestion[];
        } | null;
        if (!response.ok) throw new Error();
        const suggestions = body?.suggestions ?? [];
        setLocationSuggestions(suggestions);
        if (suggestions.length === 1) {
          setPostalCode(suggestions[0].postalCode);
          setLocality(suggestions[0].locality);
          setCounty(suggestions[0].county);
        }
      } catch {
        if (!controller.signal.aborted) setLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLocationPending(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postalCode, locality, county, listing]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value === "publish" ? "publish" : "save";
    const mileageMil = Number(mileage);
    const parsedModelYear = Number(modelYear);
    if (
      !Number.isSafeInteger(parsedModelYear) ||
      parsedModelYear < 1950 ||
      parsedModelYear > new Date().getFullYear() + 1
    ) {
      setError("Årsmodell måste väljas.");
      return;
    }
    if (!Number.isSafeInteger(mileageMil) || mileageMil < 0) {
      setError("Miltal måste vara ett heltal.");
      return;
    }
    if (!immutable && !registrationNumber.trim()) {
      setError("Registreringsnummer måste anges.");
      return;
    }
    const hasLocation = Boolean(postalCode || locality || county);
    if (
      hasLocation &&
      (!/^[1-9][0-9]{4}$/.test(postalCode.replace(/\s+/g, "")) ||
        !locality ||
        !county)
    ) {
      setError("Välj en giltig plats från postnummerförslagen.");
      return;
    }
    if (
      action === "publish" &&
      (currentListing?.images.length ?? 0) + files.length < 1
    ) {
      setError("Minst en bild krävs för publicering.");
      return;
    }
    setPendingAction(action);
    setError(undefined);
    setSuccess(undefined);
    if (action === "publish") {
      setPublishProgress({
        percent: 8,
        title: "Förbereder publicering",
        detail: "Sparar fordonsuppgifterna…",
      });
    }

    try {
      let listingId = draftId;
      const locationValues = hasLocation
        ? { postalCode, locality, county }
        : {};
      const body = immutable
        ? {
            shortComment: comment,
            ...locationValues,
            deviations,
            wantedComment,
            equipment,
            otherEquipment,
          }
        : {
            identifier: { kind: "model", value: model },
            registrationNumber,
            showRegistrationNumber,
            modelYear: parsedModelYear,
            mileageMil,
            shortComment: comment,
            ...locationValues,
            deviations,
            wantedComment,
            equipment,
            otherEquipment,
            deductibleVat: vat,
            publicationHours,
          };
      const response = await fetch(
        listingId
          ? `/api/company/listings/${listingId}`
          : "/api/company/listings",
        {
          method: listingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const responseBody = (await response.json().catch(() => null)) as {
        listing?: OwnListing;
        error?: string;
      } | null;
      if (!response.ok || !responseBody?.listing)
        throw new Error(responseBody?.error ?? "SAVE_FAILED");
      listingId = responseBody.listing.id;
      setDraftId(listingId);
      setCurrentListing(responseBody.listing);

      let workingListing = responseBody.listing;
      const openPositions = imagePositions.filter(
        (position) =>
          !workingListing.images.some((image) => image.position === position),
      );
      for (const [index, file] of files.entries()) {
        const position = openPositions[index];
        if (!position) throw new Error("IMAGE_LIMIT_EXCEEDED");
        if (action === "publish") {
          setPublishProgress({
            percent: 15 + Math.round((index / Math.max(files.length, 1)) * 65),
            title: "Bearbetar bilder",
            detail: showRegistrationNumber
              ? `Bild ${index + 1} av ${files.length} laddas upp…`
              : `Bild ${index + 1} av ${files.length} laddas upp och kontrolleras…`,
          });
        }
        setImageProgress((current) => ({
          ...current,
          [position]: "Laddar upp bild…",
        }));
        const formData = new FormData();
        formData.set("image", file);
        setImageProgress((current) => ({
          ...current,
          [position]: showRegistrationNumber
            ? "Bearbetar bild…"
            : "Kontrollerar registreringsnummer…",
        }));
        const upload = await fetch(
          `/api/company/listings/${listingId}/images/${position}`,
          {
            method: "PUT",
            body: formData,
          },
        );
        if (!upload.ok) {
          const uploadBody = (await upload.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(uploadBody?.error ?? "UPLOAD_FAILED");
        }
        const uploadBody = (await upload.json()) as { listing: OwnListing };
        workingListing = uploadBody.listing;
        setCurrentListing(uploadBody.listing);
        setFiles((current) => current.slice(1));
        const uploaded = uploadBody.listing.images.find(
          (image) => image.position === position,
        );
        setImageProgress((current) => ({
          ...current,
          [position]: redactionLabel(uploaded?.plateRedactionStatus),
        }));
        if (action === "publish") {
          setPublishProgress({
            percent:
              15 + Math.round(((index + 1) / Math.max(files.length, 1)) * 65),
            title: "Bearbetar bilder",
            detail: `Bild ${index + 1} av ${files.length} är klar.`,
          });
        }
      }

      const openDamagePositions = imagePositions.filter(
        (position) =>
          !workingListing.damageImages.some(
            (image) => image.position === position,
          ),
      );
      for (const [index, file] of damageFiles.entries()) {
        const position = openDamagePositions[index];
        if (!position) throw new Error("DAMAGE_IMAGE_LIMIT_EXCEEDED");
        if (action === "publish") {
          setPublishProgress({
            percent: 72 + Math.round(((index + 1) / Math.max(damageFiles.length, 1)) * 10),
            title: "Bearbetar skadebilder",
            detail: `Skadebild ${index + 1} av ${damageFiles.length} kontrolleras…`,
          });
        }
        const formData = new FormData();
        formData.set("image", file);
        const upload = await fetch(
          `/api/company/listings/${listingId}/damage-images/${position}`,
          { method: "PUT", body: formData },
        );
        const uploadBody = (await upload.json().catch(() => null)) as {
          listing?: OwnListing;
          error?: string;
        } | null;
        if (!upload.ok || !uploadBody?.listing) {
          throw new Error(uploadBody?.error ?? "UPLOAD_FAILED");
        }
        workingListing = uploadBody.listing;
        setCurrentListing(uploadBody.listing);
      }

      for (const [index, file] of documentFiles.entries()) {
        if (action === "publish") {
          setPublishProgress({
            percent: 83 + Math.round(((index + 1) / Math.max(documentFiles.length, 1)) * 6),
            title: "Laddar upp dokument",
            detail: `Dokument ${index + 1} av ${documentFiles.length} laddas upp…`,
          });
        }
        const formData = new FormData();
        formData.set("document", file);
        const upload = await fetch(
          `/api/company/listings/${listingId}/documents`,
          { method: "POST", body: formData },
        );
        const uploadBody = (await upload.json().catch(() => null)) as {
          listing?: OwnListing;
          error?: string;
        } | null;
        if (!upload.ok || !uploadBody?.listing) {
          throw new Error(uploadBody?.error ?? "DOCUMENT_UPLOAD_FAILED");
        }
        workingListing = uploadBody.listing;
        setCurrentListing(uploadBody.listing);
      }

      if (action === "publish") {
        setPublishProgress({
          percent: 90,
          title: "Slutför publiceringen",
          detail: "Kontrollerar bilen och gör den synlig på marknaden…",
        });
        const publish = await fetch(
          `/api/company/listings/${listingId}/publish`,
          { method: "POST" },
        );
        if (!publish.ok) {
          const publishBody = (await publish.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(publishBody?.error ?? "PUBLISH_FAILED");
        }
        setPublishProgress({
          percent: 100,
          title: "Publiceringen är klar",
          detail: "Bilen är nu publicerad.",
        });
      }

      setFiles([]);
      setDamageFiles([]);
      setDocumentFiles([]);
      if (action === "publish") {
        router.replace("/app/bilar");
        router.refresh();
        return;
      }
      if (!listing) {
        router.push(`/app/bilar/${listingId}`);
      }
      router.refresh();
      setSuccess("Ändringarna är sparade.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN";
      setError(errorMessage(code));
    } finally {
      setPendingAction(undefined);
      setPublishProgress(undefined);
    }
  }

  async function removeImage(position: ImagePosition) {
    if (!currentListing || currentListing.status !== "draft" || !editable)
      return;
    setPendingAction("save");
    setError(undefined);
    try {
      const response = await fetch(
        `/api/company/listings/${currentListing.id}/images/${position}`,
        { method: "DELETE" },
      );
      const responseBody = (await response.json().catch(() => null)) as {
        listing?: OwnListing;
      } | null;
      if (!response.ok || !responseBody?.listing) throw new Error();
      setCurrentListing(responseBody.listing);
      router.refresh();
    } catch {
      setError("Bilden kunde inte tas bort.");
    } finally {
      setPendingAction(undefined);
    }
  }

  async function withdraw() {
    if (!currentListing || currentListing.status !== "active" || !editable)
      return;
    if (!window.confirm("Dra tillbaka bilen? Den kan inte återaktiveras."))
      return;
    setPendingAction("save");
    setError(undefined);
    try {
      const response = await fetch(
        `/api/company/listings/${currentListing.id}/withdraw`,
        { method: "POST" },
      );
      const responseBody = (await response.json().catch(() => null)) as {
        listing?: OwnListing;
      } | null;
      if (!response.ok || !responseBody?.listing) throw new Error();
      setCurrentListing(responseBody.listing);
      router.refresh();
    } catch {
      setError("Bilen kunde inte dras tillbaka.");
    } finally {
      setPendingAction(undefined);
    }
  }

  function addSelectedFiles(selected: File[]) {
    const room = 5 - (currentListing?.images.length ?? 0) - files.length;
    if (room <= 0) {
      setError("Max 5 bilder är tillåtna.");
      return;
    }
    const accepted = selected.slice(0, room);
    setFiles((current) => [...current, ...accepted]);
    setError(
      selected.length > room
        ? `Max 5 bilder är tillåtna. ${selected.length - room} bild${selected.length - room === 1 ? "" : "er"} lades inte till.`
        : undefined,
    );
  }

  function addDamageFiles(selected: File[]) {
    const room =
      5 - (currentListing?.damageImages.length ?? 0) - damageFiles.length;
    const accepted = selected.slice(0, Math.max(0, room));
    setDamageFiles((current) => [...current, ...accepted]);
    setError(
      selected.length > room
        ? "Max 5 skadebilder är tillåtna."
        : undefined,
    );
  }

  function addDocumentFiles(selected: File[]) {
    const room =
      10 - (currentListing?.documents.length ?? 0) - documentFiles.length;
    const accepted = selected.slice(0, Math.max(0, room));
    setDocumentFiles((current) => [...current, ...accepted]);
    setError(
      selected.length > room ? "Max 10 dokument är tillåtna." : undefined,
    );
  }

  async function removeDamage(position: ImagePosition) {
    if (!currentListing || !editable) return;
    setPendingAction("save");
    setError(undefined);
    try {
      const response = await fetch(
        `/api/company/listings/${currentListing.id}/damage-images/${position}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as {
        listing?: OwnListing;
      } | null;
      if (!response.ok || !body?.listing) throw new Error();
      setCurrentListing(body.listing);
    } catch {
      setError("Skadebilden kunde inte tas bort.");
    } finally {
      setPendingAction(undefined);
    }
  }

  async function removeDocument(documentId: string) {
    if (!currentListing || !editable) return;
    setPendingAction("save");
    setError(undefined);
    try {
      const response = await fetch(
        `/api/company/listings/${currentListing.id}/documents/${documentId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as {
        listing?: OwnListing;
      } | null;
      if (!response.ok || !body?.listing) throw new Error();
      setCurrentListing(body.listing);
    } catch {
      setError("Dokumentet kunde inte tas bort.");
    } finally {
      setPendingAction(undefined);
    }
  }

  function toggleDeviation(value: ListingDeviation) {
    setDeviations((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-busy={pending}
      className="space-y-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
    >
      {publishProgress ? <PublishingDialog progress={publishProgress} /> : null}
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      {success ? <FormMessage type="success">{success}</FormMessage> : null}

      <label className="block font-semibold">
        Bilmodell
        <input
          aria-label="Bilmodell"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={!editable || immutable}
          maxLength={160}
          placeholder="BMW M340i xDrive"
          className={inputClassName}
          required
        />
      </label>

      <label className="block font-semibold">
        Registreringsnummer
        <input
          aria-label="Registreringsnummer"
          value={registrationNumber}
          onChange={(event) => setRegistrationNumber(event.target.value)}
          disabled={!editable || immutable}
          maxLength={16}
          autoCapitalize="characters"
          placeholder="ABC 123"
          className={inputClassName}
          required
        />
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
          Används för att identifiera bilen. Visas bara enligt valet nedan.
        </span>
      </label>

      <label
        className={`flex items-start gap-3 rounded-xl border border-[var(--border)] p-4 ${currentListing && currentListing.images.length + currentListing.damageImages.length > 0 ? "opacity-70" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={showRegistrationNumber}
          onChange={(event) => setShowRegistrationNumber(event.target.checked)}
          disabled={
            !editable ||
            immutable ||
            Boolean(
              currentListing &&
                currentListing.images.length + currentListing.damageImages.length,
            )
          }
          className="mt-1 h-5 w-5 accent-[var(--primary)]"
        />
        <span>
          <span className="block font-semibold">
            Visa registreringsnumret i annonsen
          </span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            {showRegistrationNumber
              ? "Registreringsnumret visas för behöriga marknadsanvändare och skyltar censureras inte i bilderna."
              : "Registreringsnumret döljs och registreringsskyltar censureras automatiskt i bilderna."}
            {currentListing &&
            currentListing.images.length + currentListing.damageImages.length > 0
              ? " Valet är låst efter att bilder har laddats upp."
              : " Välj innan du laddar upp bilder."}
          </span>
        </span>
      </label>

      <label className="block font-semibold">
        Årsmodell
        <select
          aria-label="Årsmodell"
          value={modelYear}
          onChange={(event) => setModelYear(event.target.value)}
          disabled={!editable || immutable}
          className={inputClassName}
          required
        >
          <option value="">Välj årsmodell</option>
          {modelYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="block font-semibold">
        Miltal <span className="font-normal text-[var(--muted)]">(mil)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={200000}
          step={1}
          value={mileage}
          onChange={(event) => setMileage(event.target.value)}
          disabled={!editable || immutable}
          placeholder="6430"
          className={inputClassName}
          required
        />
      </label>

      <fieldset disabled={!editable}>
        <legend className="font-semibold">
          Plats <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
        </legend>
        <label className="mt-2 block">
          <span className="text-sm font-medium text-[var(--muted)]">
            Postnummer
          </span>
          <input
            aria-label="Postnummer"
            inputMode="numeric"
            value={postalCode}
            onChange={(event) => {
              setPostalCode(event.target.value);
              setLocality("");
              setCounty("");
              setLocationSuggestions([]);
            }}
            maxLength={6}
            placeholder="141 52"
            className={inputClassName}
          />
        </label>
        {locationPending ? (
          <p role="status" className="mt-2 text-sm text-[var(--muted)]">
            Söker plats…
          </p>
        ) : locationSuggestions.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {locationSuggestions.map((suggestion) => (
              <button
                type="button"
                key={`${suggestion.locality}-${suggestion.county}`}
                onClick={() => {
                  setPostalCode(suggestion.postalCode);
                  setLocality(suggestion.locality);
                  setCounty(suggestion.county);
                  setLocationSuggestions([]);
                }}
                className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
              >
                {suggestion.locality}, {suggestion.county}
              </button>
            ))}
          </div>
        ) : locality && county ? (
          <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-3 text-sm">
            <span className="font-semibold">{locality}</span> · {county}
          </p>
        ) : null}
      </fieldset>

      <EquipmentSelector
        value={equipment}
        onChange={setEquipment}
        disabled={!editable}
      />

      <fieldset disabled={!editable}>
        <legend className="font-semibold">
          Avvikelser{" "}
          <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {listingDeviationKeys.map((deviation) => (
            <label
              key={deviation}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] p-3"
            >
              <input
                type="checkbox"
                checked={deviations.includes(deviation)}
                onChange={() => toggleDeviation(deviation)}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              <span>{deviationLabel(deviation)}</span>
            </label>
          ))}
        </div>
        {deviations.includes("WAS_WANTED") ? (
          <label className="mt-3 block font-medium">
            Kommentar om efterlysning{" "}
            <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
            <textarea
              value={wantedComment}
              onChange={(event) => setWantedComment(event.target.value)}
              maxLength={500}
              rows={2}
              className={`${inputClassName} resize-y`}
              placeholder="Exempel: anmäld stulen men återfunnen oskadad."
            />
            <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">
              {wantedComment.length}/500
            </span>
          </label>
        ) : null}
      </fieldset>

      <label className="block font-semibold">
        Övrig utrustning{" "}
        <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
        <textarea
          value={otherEquipment}
          onChange={(event) => setOtherEquipment(event.target.value)}
          disabled={!editable}
          maxLength={500}
          rows={2}
          placeholder="Exempel: keramiska bromsar, Individual-läder"
          className={`${inputClassName} resize-y`}
        />
        <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">
          {otherEquipment.length}/500
        </span>
      </label>

      <label className="block font-semibold">
        Kommentar{" "}
        <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={!editable}
          maxLength={500}
          rows={4}
          placeholder="Svensksåld. M-sport. HUD. Några mindre märken."
          className={`${inputClassName} resize-y`}
        />
        <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">
          {comment.length}/500
        </span>
      </label>

      <fieldset disabled={!editable || immutable}>
        <legend className="font-semibold">Avdragbar moms</legend>
        <div className="mt-2 flex gap-3">
          {[true, false].map((value) => (
            <label
              key={String(value)}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 font-semibold ${vat === value ? "border-[var(--primary)] bg-[var(--surface-selected)] text-[var(--primary)]" : "border-[var(--border)]"}`}
            >
              <input
                type="radio"
                checked={vat === value}
                onChange={() => setVat(value)}
                className="sr-only"
              />
              {value ? "Ja" : "Nej"}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block font-semibold">
        Publiceringstid
        <select
          aria-label="Publiceringstid"
          value={publicationHours === null ? "unlimited" : publicationHours}
          onChange={(event) =>
            setPublicationHours(
              event.target.value === "unlimited"
                ? null
                : Number(event.target.value),
            )
          }
          disabled={!editable || immutable}
          className={inputClassName}
        >
          <option value={48}>48 timmar</option>
          <option value={72}>3 dagar</option>
          <option value={96}>4 dagar</option>
          <option value={120}>5 dagar</option>
          {allowUnlimitedPublication ? (
            <option value="unlimited">Obegränsad</option>
          ) : null}
        </select>
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
          Annonsen tas automatiskt bort från marknaden när tiden löper ut.
        </span>
      </label>

      <fieldset disabled={!editable || immutable}>
        <legend className="font-semibold">
          Bilder{" "}
          <span className="font-normal text-[var(--muted)]">
            — minst 1, högst 5 vid publicering
          </span>
        </legend>
        {editable && !immutable ? (
          <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--primary-hover)]">
            + Lägg till bilder
            <input
              aria-label="Lägg till bilder"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                addSelectedFiles(Array.from(event.target.files ?? []));
                event.currentTarget.value = "";
              }}
            />
          </label>
        ) : null}
        <p className="mt-3 text-sm font-medium text-[var(--primary)]">
          {(currentListing?.images.length ?? 0) + files.length} av 5 bilder
          valda
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...(currentListing?.images ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((existing) => (
              <div
                key={existing.id}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[var(--surface-subtle)]">
                  {/* Image is served by a tenant-authorized private route. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existing.url}
                    alt={`Fordonsbild ${existing.position}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-semibold">
                    Bild {existing.position}
                  </p>
                  {currentListing?.status === "draft" && editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        void removeImage(existing.position as ImagePosition)
                      }
                      className="min-h-11 w-full text-sm font-semibold text-[var(--danger)]"
                    >
                      Ta bort
                    </button>
                  ) : null}
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {imageProgress[existing.position as ImagePosition] ??
                      redactionLabel(existing.plateRedactionStatus)}
                  </p>
                </div>
              </div>
            ))}
          {files.map((file, index) => (
            <SelectedImagePreview
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              position={selectedPositions[index] ?? index + 1}
              onRemove={() =>
                setFiles((current) =>
                  current.filter((_, currentIndex) => currentIndex !== index),
                )
              }
            />
          ))}
          {Array.from(
            {
              length: Math.max(
                0,
                5 - (currentListing?.images.length ?? 0) - files.length,
              ),
            },
            (_, index) => (
              <div
                key={`empty-${index}`}
                className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] text-sm text-[var(--muted)]"
              >
                Ledig bildplats
              </div>
            ),
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          JPEG, PNG eller WebP. Högst 10 MB per bild.
        </p>
      </fieldset>

      <fieldset disabled={!editable}>
        <legend className="font-semibold">
          Skadebilder{" "}
          <span className="font-normal text-[var(--muted)]">
            — frivilligt, högst 5
          </span>
        </legend>
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--primary)] hover:bg-[var(--surface-subtle)]">
          + Ladda upp skadebilder
          <input
            aria-label="Ladda upp skadebilder"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              addDamageFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-3 text-sm font-medium text-[var(--primary)]">
          {(currentListing?.damageImages.length ?? 0) + damageFiles.length} av 5 skadebilder valda
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...(currentListing?.damageImages ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((existing) => (
              <div key={existing.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]">
                <div className="aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={existing.url} alt={`Skadebild ${existing.position}`} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold">Skadebild {existing.position}</p>
                  <button type="button" onClick={() => void removeDamage(existing.position as ImagePosition)} className="min-h-11 w-full text-sm font-semibold text-[var(--danger)]">
                    Ta bort
                  </button>
                  <p className="text-xs text-[var(--muted)]">{redactionLabel(existing.plateRedactionStatus)}</p>
                </div>
              </div>
            ))}
          {damageFiles.map((file, index) => (
            <SelectedImagePreview
              key={`damage-${file.name}-${file.lastModified}-${index}`}
              file={file}
              position={selectedDamagePositions[index] ?? index + 1}
              onRemove={() => setDamageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Samma registreringsnummerkontroll gäller som för vanliga bilder.
        </p>
      </fieldset>

      <fieldset disabled={!editable}>
        <legend className="font-semibold">
          Dokument{" "}
          <span className="font-normal text-[var(--muted)]">(frivilligt)</span>
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ladda upp servicehistorik, besiktningsprotokoll eller annan relevant fordonsdokumentation.
        </p>
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--primary)] hover:bg-[var(--surface-subtle)]">
          + Lägg till dokument
          <input
            aria-label="Lägg till dokument"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            className="sr-only"
            onChange={(event) => {
              addDocumentFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-[var(--muted)]">
          PDF, JPEG eller PNG. Högst 10 dokument och 15 MB per dokument.
        </p>
        <ul className="mt-3 space-y-2">
          {(currentListing?.documents ?? []).map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
              <a href={document.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline">
                {document.name}
              </a>
              <button type="button" onClick={() => void removeDocument(document.id)} className="min-h-11 px-2 text-sm font-semibold text-[var(--danger)]">
                Ta bort
              </button>
            </li>
          ))}
          {documentFiles.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--border)] p-3">
              <span className="truncate text-sm font-semibold">{file.name}</span>
              <button type="button" onClick={() => setDocumentFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 px-2 text-sm font-semibold text-[var(--danger)]">
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {editable ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-end">
          {currentListing?.status === "active" ? (
            <button
              type="button"
              onClick={() => void withdraw()}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center px-4 font-semibold text-[var(--danger)]"
            >
              Dra tillbaka
            </button>
          ) : null}
          <button
            type="submit"
            value="save"
            disabled={pending}
            className={secondaryButtonClassName}
          >
            {pendingAction === "save"
              ? "Sparar…"
              : currentListing?.status === "active" ||
                  currentListing?.status === "inactive"
                ? "Spara korrigeringar"
                : "Spara utkast"}
          </button>
          {!currentListing || currentListing.status === "draft" ? (
            <button
              type="submit"
              value="publish"
              disabled={pending}
              className={primaryButtonClassName}
            >
              {pendingAction === "publish" ? "Publicerar…" : "Publicera bil"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
          Du har läsbehörighet och kan inte ändra bilen.
        </p>
      )}
    </form>
  );
}

function errorMessage(code: string) {
  if (
    code === "REGISTRATION_NUMBER_REQUIRED" ||
    code === "INVALID_REGISTRATION_NUMBER"
  )
    return "Ett giltigt registreringsnummer måste anges.";
  if (code === "REGISTRATION_VISIBILITY_LOCKED_AFTER_IMAGES")
    return "Synligheten kan inte ändras efter att bilder har laddats upp. Ta bort bilderna först.";
  if (code === "MODEL_YEAR_REQUIRED" || code === "INVALID_MODEL_YEAR")
    return "Årsmodell måste väljas.";
  if (code === "IMAGE_COUNT_REQUIRED")
    return "Minst en och högst fem giltiga bilder krävs för publicering.";
  if (code === "IMAGE_LIMIT_EXCEEDED" || code === "INVALID_IMAGE_POSITION")
    return "Max 5 bilder är tillåtna.";
  if (code === "IMAGE_REDACTION_INCOMPLETE")
    return "Alla bilder måste vara kontrollerade. Byt bilden eller kontakta administratören om granskning krävs.";
  if (code === "IMAGE_REDACTION_AUTHENTICATION_FAILED")
    return "Bildkontrollen kan inte autentisera sig mot leverantören. Administratören behöver kontrollera API-token.";
  if (code === "IMAGE_REDACTION_TEMPORARILY_UNAVAILABLE")
    return "Bildkontrollen är tillfälligt överbelastad. Vänta en minut och ladda sedan upp bilden igen.";
  if (code === "IMAGE_REDACTION_FAILED")
    return "Bildkontrollen kunde inte slutföras. Försök ladda upp bilden igen. Kontakta administratören om felet återkommer.";
  if (code === "IMAGE_REDACTION_REVIEW_REQUIRED")
    return "Minst en bild behöver granskas. Byt den markerade bilden eller kontakta administratören.";
  if (code === "INVALID_IMAGE_TYPE")
    return "Bilden är inte en giltig JPEG-, PNG- eller WebP-fil.";
  if (code === "INVALID_IMAGE_SIZE")
    return "Bilden är tom eller större än 10 MB.";
  if (code === "IMAGE_STORAGE_UNAVAILABLE")
    return "Bildlagringen svarar inte just nu. Försök igen – bilens utkast är redan sparat.";
  if (code === "ACTIVE_LISTING_FIELDS_LOCKED")
    return "Bilmodell, årsmodell, miltal och moms är låsta efter publicering.";
  if (code === "INVALID_LISTING_INPUT" || code === "INVALID_IDENTIFIER")
    return "Kontrollera bilmodell, årsmodell och övriga obligatoriska uppgifter.";
  if (code === "FORBIDDEN" || code === "ACTIVE_MEMBERSHIP_REQUIRED")
    return "Du saknar behörighet att publicera bilen.";
  if (code === "UPLOAD_FAILED") return "En bild kunde inte laddas upp.";
  return "Det gick inte att spara bilen. Kontrollera uppgifterna och försök igen.";
}

function PublishingDialog({ progress }: { progress: PublishProgress }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publishing-title"
        aria-describedby="publishing-detail"
        className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-blue-100 border-t-[var(--primary)]"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--primary)]">
              Publicerar bilen
            </p>
            <h2
              id="publishing-title"
              className="text-xl font-bold tracking-tight"
            >
              {progress.title}
            </h2>
          </div>
        </div>
        <div
          className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-label="Publiceringsförlopp"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <p
            id="publishing-detail"
            role="status"
            aria-live="polite"
            className="pr-4 text-[var(--muted)]"
          >
            {progress.detail}
          </p>
          <span className="shrink-0 font-semibold tabular-nums">
            {progress.percent}%
          </span>
        </div>
        <p className="mt-5 text-xs text-[var(--muted)]">
          Stäng inte sidan medan bilderna kontrolleras.
        </p>
      </div>
    </div>
  );
}

function modelYears() {
  const years: number[] = [];
  for (let year = new Date().getFullYear() + 1; year >= 1950; year -= 1)
    years.push(year);
  return years;
}

export function deviationLabel(value: ListingDeviation) {
  return {
    WAS_WANTED: "Fordonet har varit efterlyst",
    PRIVATE_IMPORT: "Privatimport",
    MILEAGE_HISTORY_ANOMALY: "Miltalshistoriken innehåller avvikelser",
    REPAIRED: "Fordonet har reparerats",
  }[value];
}

function SelectedImagePreview({
  file,
  position,
  onRemove,
}: {
  file: File;
  position: number;
  onRemove: () => void;
}) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]">
      <div className="aspect-[4/3] overflow-hidden bg-[var(--surface-subtle)]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Förhandsvisning av bild ${position}`}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-semibold">
          Bild {position} · {file.name}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 w-full text-sm font-semibold text-[var(--danger)]"
        >
          Ta bort
        </button>
        <p className="text-xs text-[var(--muted)]">Redo att laddas upp</p>
      </div>
    </div>
  );
}

function redactionLabel(
  status?: OwnListing["images"][number]["plateRedactionStatus"],
) {
  if (status === "PLATE_REDACTED")
    return "Registreringsnummer hittades och censurerades";
  if (status === "NO_PLATE_DETECTED")
    return "Inget registreringsnummer hittades";
  if (status === "REVIEW_REQUIRED")
    return "Kontrollen är osäker – granskning krävs";
  if (status === "FAILED") return "Bildkontrollen misslyckades";
  if (status === "PROCESSING") return "Kontrollerar registreringsnummer…";
  return "Registreringsnumret är inte kontrollerat";
}
