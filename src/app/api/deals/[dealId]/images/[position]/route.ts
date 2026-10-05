import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireCompanyPermission,
} from "@/server/company/context";
import { readDealImage } from "@/server/deals";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string; position: string }> },
) {
  try {
    const current = await requireCompanyPermission(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
      "listing:read",
    );
    const values = await params;
    const parsed = z
      .object({
        dealId: z.uuid(),
        position: z.coerce.number().int().min(1).max(5),
      })
      .safeParse(values);
    if (!parsed.success) throw new AccessError(404, "IMAGE_NOT_FOUND");
    const image = await readDealImage({
      companyId: current.company.id,
      dealId: parsed.data.dealId,
      position: parsed.data.position,
    });
    return new Response(image.bytes as BodyInit, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
