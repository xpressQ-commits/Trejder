import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerPermission,
} from "@/server/company/context";
import { updateCompanyContact } from "@/server/company/profile";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

const inputSchema = z
  .object({
    contactEmail: z.email().max(320),
    contactPhone: z.string().trim().min(5).max(40),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerPermission(
      request.headers,
      companyId,
      "company:manage",
    );
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_COMPANY_CONTACT");
    const contact = await updateCompanyContact({
      actorUserId: context.user.id,
      companyId: context.company.id,
      ...parsed.data,
    });
    return Response.json({ contact });
  } catch (error) {
    return errorResponse(error);
  }
}
