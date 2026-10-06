import { cookies } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireDealerAdminForBilling } from "@/server/company/context";
import { createPremiumCheckout } from "@/server/stripe";
import { assertSameOrigin, errorResponse } from "@/server/security";
export async function POST(request: Request) { try {
  assertSameOrigin(request); const context = await requireDealerAdminForBilling(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null);
  return Response.json(await createPremiumCheckout(context.company.id, context.user.id));
} catch (error) { return errorResponse(error); } }
