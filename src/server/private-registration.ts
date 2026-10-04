import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { account, auditLog, company, companyMembership, privateRegistration, user } from "@/server/db/schema";
import { sendPrivateRegistrationEmail } from "@/server/email";
import { AccessError, normalizeEmail } from "@/server/security";

const TTL_MS = 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function beginPrivateRegistration(input: { name: string; phone: string; email: string; password: string }) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2 || name.length > 200 || phone.length < 5 || phone.length > 40) throw new AccessError(400, "INVALID_ACCOUNT_DETAILS");
  if (input.password.length < 12 || input.password.length > 128) throw new AccessError(400, "INVALID_PASSWORD");
  const [existing] = await getDb().select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
  if (existing) throw new AccessError(409, "USER_EMAIL_EXISTS");
  const token = randomBytes(32).toString("base64url");
  await getDb().transaction(async (tx) => {
    await tx.delete(privateRegistration).where(sql`lower(${privateRegistration.email}) = ${email} AND ${privateRegistration.consumedAt} IS NULL`);
    await tx.insert(privateRegistration).values({ email, name, phone, passwordHash: await hashPassword(input.password), tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) });
  });
  await sendPrivateRegistrationEmail({ email, name, token });
}

export async function completePrivateRegistration(token: string) {
  if (token.length < 32) throw new AccessError(404, "INVALID_PRIVATE_REGISTRATION");
  return getDb().transaction(async (tx) => {
    const [registration] = await tx.select().from(privateRegistration).where(eq(privateRegistration.tokenHash, hashToken(token))).for("update");
    if (!registration || registration.consumedAt || registration.expiresAt <= new Date()) throw new AccessError(404, "INVALID_PRIVATE_REGISTRATION");
    const [existing] = await tx.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${registration.email}`).limit(1);
    if (existing) throw new AccessError(409, "USER_EMAIL_EXISTS");
    const userId = randomUUID();
    const organizationNumber = `P-${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    await tx.insert(user).values({ id: userId, name: registration.name, email: registration.email, emailVerified: true });
    await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: registration.passwordHash });
    const [privateCompany] = await tx.insert(company).values({ legalName: registration.name, organizationNumber, contactEmail: registration.email, contactPhone: registration.phone, kind: "private" }).returning({ id: company.id });
    await tx.insert(companyMembership).values({ companyId: privateCompany.id, userId, role: "private_customer" });
    const consumed = await tx.update(privateRegistration).set({ consumedAt: new Date() }).where(and(eq(privateRegistration.id, registration.id), isNull(privateRegistration.consumedAt))).returning({ id: privateRegistration.id });
    if (consumed.length !== 1) throw new AccessError(409, "PRIVATE_REGISTRATION_ALREADY_USED");
    await tx.insert(auditLog).values({ actorUserId: userId, actorCompanyId: privateCompany.id, action: "private_customer.created", aggregateType: "user", aggregateId: userId });
    return { userId, companyId: privateCompany.id };
  });
}
