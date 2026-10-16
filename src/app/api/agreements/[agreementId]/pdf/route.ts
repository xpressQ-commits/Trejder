import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company/context";
import { readAgreementPdf } from "@/server/agreements";
import { requireAgreementAccess } from "@/server/agreements/access";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  try {
    const context = await requireAgreementAccess(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    );
    const id = z.uuid().safeParse((await params).agreementId);
    if (!id.success) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
    const file = await readAgreementPdf({
      companyId: context.company.id,
      actorUserId: context.user.id,
      agreementId: id.data,
    });
    const body = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;
    const disposition = new URL(request.url).searchParams.get("inline") === "1"
      ? "inline"
      : "attachment";
    return new Response(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="${file.fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
