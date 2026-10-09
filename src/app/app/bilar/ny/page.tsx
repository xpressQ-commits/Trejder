import { redirect } from "next/navigation";
import { VehicleListingForm } from "@/components/vehicles/vehicle-listing-form";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { getTranslations } from "@/i18n/server";

export default async function NewVehiclePage() {
  const context = await getCurrentCompanyContext();
  const { t } = await getTranslations();
  if (context.membership.role === "viewer") redirect("/app/bilar");
  return (
    <section aria-labelledby="new-vehicle-title">
      <p className="text-sm font-semibold text-[var(--primary)]">
        {t("listing.newEyebrow")}
      </p>
      <h1
        id="new-vehicle-title"
        className="mt-1 text-3xl font-semibold tracking-tight"
      >
        {t("listing.newTitle")}
      </h1>
      <p className="mt-3 text-[var(--muted)]">{t("listing.newDescription")}</p>
      <div className="mt-7">
        <VehicleListingForm
          allowUnlimitedPublication={context.company.isPlatformOwner}
        />
      </div>
    </section>
  );
}
