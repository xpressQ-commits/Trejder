import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { notification } from "@/server/db/schema";
export function listUserNotifications(userId: string) {
  return getDb()
    .select()
    .from(notification)
    .where(eq(notification.recipientUserId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(30);
}
export function markUserNotificationsRead(
  userId: string,
  notificationId?: string,
) {
  return getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.recipientUserId, userId),
        notificationId ? eq(notification.id, notificationId) : undefined,
        isNull(notification.readAt),
      ),
    );
}
export async function countUnreadNotifications(
  userId: string,
): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(notification)
    .where(
      and(
        eq(notification.recipientUserId, userId),
        isNull(notification.readAt),
      ),
    );
  return Number(row?.value ?? 0);
}
