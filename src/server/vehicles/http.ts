import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { AccessError } from "@/server/security";

export const listingInputSchema = z.object({
  identifier: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("registration"), value: z.string().min(1).max(16) }).strict(),
    z.object({ kind: z.literal("model"), value: z.string().min(1).max(160) }).strict(),
  ]),
  mileageMil: z.number().int().min(0).max(200_000),
  shortComment: z.string().min(1).max(500),
  deductibleVat: z.boolean(),
}).strict();

export async function requireListingContext(request: Request, mutate: boolean) {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return requireCompanyPermission(
    request.headers,
    companyId,
    mutate ? "listing:mutate" : "listing:read",
  );
}

export function parseListingId(value: string): string {
  if (!z.uuid().safeParse(value).success) throw new AccessError(404, "LISTING_NOT_FOUND");
  return value;
}

export function parseImagePosition(value: string): number {
  const parsed = z.coerce.number().int().min(1).max(5).safeParse(value);
  if (!parsed.success) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return parsed.data;
}
