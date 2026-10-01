import { redirect } from "next/navigation";
import { VehicleListingForm } from "@/components/vehicles/vehicle-listing-form";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";

export default async function NewVehiclePage() {
  const context = await getCurrentCompanyContext();
  if (context.membership.role === "viewer") redirect("/app/bilar");
  return <section aria-labelledby="new-vehicle-title"><p className="text-sm font-semibold text-[var(--primary)]">Ny bil</p><h1 id="new-vehicle-title" className="mt-1 text-3xl font-semibold tracking-tight">Lägg upp bil</h1><p className="mt-3 text-[var(--muted)]">Modell, årsmodell och upp till fem bilder. Klart.</p><div className="mt-7"><VehicleListingForm /></div></section>;
}
