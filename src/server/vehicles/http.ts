import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireCompanyPermission,
} from "@/server/company/context";
import { AccessError } from "@/server/security";
import { equipmentKeys } from "@/domain/equipment";
import { listingDeviationKeys } from "@/domain/listing-details";

export const listingInputObjectSchema = z
  .object({
    identifier: z
      .object({ kind: z.literal("model"), value: z.string().min(1).max(160) })
      .strict(),
    registrationNumber: z.string().min(1).max(32),
    showRegistrationNumber: z.boolean(),
    modelYear: z
      .number()
      .int()
      .min(1950)
      .max(new Date().getUTCFullYear() + 1),
    mileageMil: z.number().int().min(0).max(200_000),
    shortComment: z.string().max(500).default(""),
    postalCode: z.string().regex(/^\s*[1-9][0-9]{2}\s?[0-9]{2}\s*$/).optional(),
    locality: z.string().trim().min(1).max(120).optional(),
    county: z.string().trim().min(1).max(120).optional(),
    deviations: z
      .array(z.enum(listingDeviationKeys))
      .max(listingDeviationKeys.length)
      .refine((items) => new Set(items).size === items.length)
      .default([]),
    wantedComment: z.string().max(500).nullable().optional(),
    equipment: z
      .array(z.enum(equipmentKeys))
      .max(equipmentKeys.length)
      .refine(
        (items) => new Set(items).size === items.length,
        "Duplicate equipment",
      )
      .default([]),
    otherEquipment: z.string().max(500).nullable().optional(),
    deductibleVat: z.boolean(),
    publicationHours: z.union([
      z.literal(48),
      z.literal(72),
      z.literal(96),
      z.literal(120),
      z.null(),
    ]),
  })
  .strict();

export const listingInputSchema = listingInputObjectSchema
  .refine(
    (value) =>
      [value.postalCode, value.locality, value.county].every(
        (item) => item === undefined,
      ) ||
      [value.postalCode, value.locality, value.county].every(
        (item) => item !== undefined,
      ),
    "Location must be complete",
  );

export async function requireListingContext(request: Request, mutate: boolean) {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return requireCompanyPermission(
    request.headers,
    companyId,
    mutate ? "listing:mutate" : "listing:read",
  );
}

export function parseListingId(value: string): string {
  if (!z.uuid().safeParse(value).success)
    throw new AccessError(404, "LISTING_NOT_FOUND");
  return value;
}

export function parseImagePosition(value: string): number {
  const parsed = z.coerce.number().int().min(1).max(5).safeParse(value);
  if (!parsed.success) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return parsed.data;
}

export function parseDocumentId(value: string): string {
  if (!z.uuid().safeParse(value).success)
    throw new AccessError(404, "DOCUMENT_NOT_FOUND");
  return value;
}
