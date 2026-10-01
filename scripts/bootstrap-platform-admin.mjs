import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const rawEmail = process.env.TREJDER_ADMIN_EMAIL;
const password = process.env.TREJDER_ADMIN_PASSWORD;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!rawEmail) throw new Error("TREJDER_ADMIN_EMAIL is required");
if (!password) throw new Error("TREJDER_ADMIN_PASSWORD is required");

const email = rawEmail.trim().toLowerCase();
if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("TREJDER_ADMIN_EMAIL must be a valid email address");
}
if (password.length < 12 || password.length > 128) {
  throw new Error("TREJDER_ADMIN_PASSWORD must contain between 12 and 128 characters");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const outcome = await sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1 FOR UPDATE
    `;
    const userId = existing[0]?.id ?? randomUUID();
    if (existing.length > 0) {
      const alreadyAdmin = await tx`SELECT user_id FROM platform_admins WHERE user_id = ${userId}`;
      if (alreadyAdmin.length > 0) return { createdUser: false, promoted: false };
    }
    const passwordHash = await hashPassword(password);
    if (existing.length === 0) {
      await tx`
        INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
        VALUES (${userId}, 'Trejder administratör', ${email}, true, now(), now())
      `;
      await tx`
        INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash}, now(), now())
      `;
    } else {
      await tx`
        UPDATE users SET email_verified = true, updated_at = now() WHERE id = ${userId}
      `;
      const credential = await tx`
        SELECT id FROM accounts
        WHERE user_id = ${userId} AND provider_id = 'credential'
        LIMIT 1 FOR UPDATE
      `;
      if (credential.length === 0) {
        await tx`
          INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash}, now(), now())
        `;
      } else {
        await tx`
          UPDATE accounts SET password = ${passwordHash}, updated_at = now()
          WHERE id = ${credential[0].id}
        `;
      }
      await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
    }
    const inserted = await tx`
      INSERT INTO platform_admins (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id
    `;
    return { createdUser: existing.length === 0, promoted: inserted.length === 1 };
  });
  const result = outcome.createdUser
    ? "Platform administrator created."
    : outcome.promoted
      ? "Existing user promoted to platform administrator."
      : "Platform administrator already configured; no changes made.";
  console.log(result);
} finally {
  await sql.end();
}
