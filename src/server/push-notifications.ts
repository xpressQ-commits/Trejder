import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/server/db";
import { pushSubscription } from "@/server/db/schema";

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export function notificationUrl(input: {
  type: string;
  resourceType: string;
  resourceId: string;
}) {
  if (input.resourceType === "match") return `/app/affarer/${input.resourceId}`;
  if (input.resourceType === "chat_thread")
    return `/app/chattar?thread=${input.resourceId}`;
  if (
    input.resourceType === "listing" &&
    (input.type === "bid.received" || input.type === "question.received")
  )
    return `/app/bilar/${input.resourceId}`;
  if (input.resourceType === "listing")
    return `/app/marknad/${input.resourceId}`;
  return "/app/oversikt#notiser";
}

function configuration() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:info@trejder.se";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getPushPublicKey() {
  return configuration()?.publicKey ?? null;
}

export function isTrustedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return [
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "push.services.mozilla.com",
      "web.push.apple.com",
      "notify.windows.com",
    ].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiresAt: Date | null;
}) {
  await getDb()
    .insert(pushSubscription)
    .values(input)
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        expiresAt: input.expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await getDb()
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, userId),
        eq(pushSubscription.endpoint, endpoint),
      ),
    );
}

export async function sendPushToUsers(userIds: string[], message: PushMessage) {
  try {
    const config = configuration();
    const recipients = [...new Set(userIds)];
    if (!config || recipients.length === 0) return;
    webpush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
    const subscriptions = await getDb()
      .select()
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, recipients));
    const expired: string[] = [];
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(message),
            { TTL: 60 * 60 },
          );
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            expired.push(subscription.endpoint);
            return;
          }
          console.error("Web Push delivery failed", { statusCode });
        }
      }),
    );
    if (expired.length)
      await getDb()
        .delete(pushSubscription)
        .where(inArray(pushSubscription.endpoint, expired));
  } catch {
    console.error("Web Push dispatch could not be initialized");
  }
}
