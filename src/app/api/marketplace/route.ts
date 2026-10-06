import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerMembershipPermission,
} from "@/server/company/context";
import { listMarketplaceListings } from "@/server/marketplace/listings";
import { AccessError, errorResponse } from "@/server/security";

const querySchema = z
  .object({
    search: z.string().max(160).optional(),
    vat: z.enum(["all", "yes", "no"]).default("all"),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(24).default(12),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerMembershipPermission(
      request.headers,
      companyId,
      "listing:read",
    );
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success)
      throw new AccessError(400, "INVALID_MARKETPLACE_FILTERS");
    return Response.json(
      await listMarketplaceListings({
        activeCompanyId: context.company.id,
        ...parsed.data,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
