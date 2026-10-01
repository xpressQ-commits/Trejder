import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { platformAdmin } from "@/server/db/schema";
import { requireAuthenticatedUser } from "@/server/company/context";
import { AccessError } from "@/server/security";

/** Requires fresh authentication plus an explicit platform authority record. */
export async function requirePlatformAdmin(headers: Headers) {
  const user = await requireAuthenticatedUser(headers);
  const [authority] = await getDb().select({ userId: platformAdmin.userId })
    .from(platformAdmin).where(eq(platformAdmin.userId, user.id)).limit(1);
  if (!authority) throw new AccessError(403, "PLATFORM_ADMIN_REQUIRED");
  return user;
}
