import { z } from "zod";
import { sendAccountApplication } from "@/server/account-applications";
import { AccessError, assertSameOrigin, errorResponse, normalizeEmail } from "@/server/security";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  companyName: z.string().trim().min(1).max(200),
  organizationNumber: z.string().trim().min(6).max(20),
  phone: z.string().trim().min(5).max(40),
  email: z.email().max(320),
  website: z.string().max(0).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_ACCOUNT_APPLICATION");
    await sendAccountApplication({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      companyName: parsed.data.companyName,
      organizationNumber: parsed.data.organizationNumber,
      phone: parsed.data.phone,
      email: normalizeEmail(parsed.data.email),
    });
    return Response.json({ submitted: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
