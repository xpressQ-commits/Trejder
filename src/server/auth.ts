import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/server/db";
import { account, session, user, verification } from "@/server/db/schema";
import { getEmailTransport } from "@/server/email";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  const options = {
    appName: "Handlarbörsen",
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: process.env.BETTER_AUTH_URL ? [new URL(process.env.BETTER_AUTH_URL).origin] : [],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: resetUser, url }) => {
        await getEmailTransport().send({
          to: resetUser.email,
          subject: "Återställ lösenord för Handlarbörsen",
          text: `Återställ ditt lösenord via ${url}`,
        });
      },
    },
    emailVerification: {
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user: pendingUser, url }) => {
        await getEmailTransport().send({
          to: pendingUser.email,
          subject: "Verifiera e-post för Handlarbörsen",
          text: `Verifiera din e-postadress via ${url}`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  authInstance ??= createAuth();
  return authInstance;
}
