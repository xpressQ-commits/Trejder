import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireActiveCompanyContext } from "@/server/company/context";
import { getDb } from "@/server/db";
import { auditLog, company, user } from "@/server/db/schema";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const schema = z.object({ name: z.string().trim().min(2).max(200), phone: z.string().trim().min(5).max(40) }).strict();
export async function PATCH(request: Request) { try { assertSameOrigin(request); const current = await requireActiveCompanyContext(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null); if (current.company.kind !== "private" || current.membership.role !== "private_customer") throw new AccessError(403, "PRIVATE_CUSTOMER_ACCESS_REQUIRED"); const parsed = schema.safeParse(await request.json()); if (!parsed.success) throw new AccessError(400, "INVALID_PROFILE"); await getDb().transaction(async (tx) => { await tx.update(user).set({ name: parsed.data.name }).where(eq(user.id, current.user.id)); await tx.update(company).set({ legalName: parsed.data.name, contactPhone: parsed.data.phone }).where(eq(company.id, current.company.id)); await tx.insert(auditLog).values({ actorUserId: current.user.id, actorCompanyId: current.company.id, action: "private_customer.profile_updated", aggregateType: "user", aggregateId: current.user.id }); }); return Response.json({ ok: true }); } catch (error) { return errorResponse(error); } }
