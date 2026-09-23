import { OwnListings } from "@/components/vehicles/own-listings";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";

export default async function OwnVehiclesPage() {
  const context = await getCurrentCompanyContext();
  return <OwnListings canMutate={context.membership.role !== "viewer"} />;
}
