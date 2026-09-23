import { z } from "zod";
import { getAuthenticatedUser } from "@/server/company/context";
import { acceptCompanyInvitation } from "@/server/company/invitations";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = z.object({
      token: z.string().min(32).max(200),
      name: z.string().trim().min(1).max(200).optional(),
      password: z.string().min(12).max(128).optional(),
    }).strict().safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const authenticatedUser = await getAuthenticatedUser(request.headers);
    const result = await acceptCompanyInvitation({ token: parsed.data.token, authenticatedUser, name: parsed.data.name, password: parsed.data.password });
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}
