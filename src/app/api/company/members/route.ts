import { cookies } from "next/headers";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerAdminForBilling,
} from "@/server/company/context";
import { listCompanyMembers } from "@/server/company/members";
import { errorResponse } from "@/server/security";

export async function GET(request: Request) {
  try {
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerAdminForBilling(
      request.headers,
      companyId,
    );
    return Response.json({
      members: await listCompanyMembers(context.company.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
