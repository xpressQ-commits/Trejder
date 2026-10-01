import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { platformAdmin } from "@/server/db/schema";
import { requireAuthenticatedUser } from "@/server/company/context";
import { AccessError } from "@/server/security";

/** Requires fresh authentication plus an explicit platform authority record. */
export async function requirePlatformAdmin(headers: Headers) {
  const user = await requireAuthenticatedUser(headers);
  if (!await hasPlatformAdminAuthority(user.id)) throw new AccessError(403, "PLATFORM_ADMIN_REQUIRED");
  return user;
}

export async function hasPlatformAdminAuthority(userId: string) {
  const [authority] = await getDb().select({ userId: platformAdmin.userId })
    .from(platformAdmin).where(eq(platformAdmin.userId, userId)).limit(1);
  return Boolean(authority);
}
