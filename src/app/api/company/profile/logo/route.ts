import sharp from "sharp";
import { cookies } from "next/headers";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerAdminForBilling,
  requireDealerMembershipPermission,
} from "@/server/company/context";
import {
  getCompanyLogo,
  replaceCompanyLogo,
} from "@/server/company/profile";
import {
  createPrivateCompanyLogoObjectKey,
  getImageStorage,
  validateImage,
} from "@/server/storage/images";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

export async function GET(request: Request) {
  try {
    const context = await requireDealerMembershipPermission(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
      "company:read",
    );
    const logo = await getCompanyLogo(context.company.id);
    return new Response(
      Buffer.from(await getImageStorage().read(logo.objectKey)),
      {
        headers: {
          "Content-Type": logo.mimeType,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  let objectKey: string | undefined;
  try {
    assertSameOrigin(request);
    const context = await requireDealerAdminForBilling(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    );
    const file = (await request.formData()).get("logo");
    if (!(file instanceof File)) {
      throw new AccessError(400, "COMPANY_LOGO_REQUIRED");
    }
    const source = new Uint8Array(await file.arrayBuffer());
    validateImage(source, file.type);
    const optimized = new Uint8Array(
      await sharp(source)
        .rotate()
        .resize({
          width: 720,
          height: 260,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
    objectKey = createPrivateCompanyLogoObjectKey();
    const storage = getImageStorage();
    await storage.put(objectKey, optimized, "image/png");
    const { previousObjectKey } = await replaceCompanyLogo({
      actorUserId: context.user.id,
      companyId: context.company.id,
      objectKey,
    });
    if (previousObjectKey) {
      await storage.delete(previousObjectKey).catch(() => undefined);
    }
    return Response.json({ logoUrl: "/api/company/profile/logo" });
  } catch (error) {
    if (objectKey) {
      await getImageStorage().delete(objectKey).catch(() => undefined);
    }
    return errorResponse(error);
  }
}
