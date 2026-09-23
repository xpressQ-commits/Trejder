import { timingSafeEqual } from "node:crypto";

export class AccessError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new AccessError(403, "INVALID_ORIGIN");
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured || new URL(origin).origin !== new URL(configured).origin) {
    throw new AccessError(403, "INVALID_ORIGIN");
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function constantTimeTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AccessError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  console.error("Unhandled server error", error);
  return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
