import { redirect } from "next/navigation";
import { getOptionalCurrentCompanyContext } from "@/app/app/_lib/current-context";

export default async function AppHomePage() {
  const context = await getOptionalCurrentCompanyContext();
  if (!context) return null;
  redirect(
    context.membership.role === "private_customer"
      ? "/app/oversikt"
      : "/app/marknad",
  );
}
