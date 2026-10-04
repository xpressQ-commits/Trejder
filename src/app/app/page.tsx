import { redirect } from "next/navigation";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";

export default async function AppHomePage() {
  const context = await getCurrentCompanyContext();
  redirect(context.membership.role === "private_customer" ? "/app/oversikt" : "/app/marknad");
}
