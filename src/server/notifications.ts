import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { notification } from "@/server/db/schema";
export function listUserNotifications(userId: string) { return getDb().select().from(notification).where(eq(notification.recipientUserId, userId)).orderBy(desc(notification.createdAt)).limit(30); }
export function markUserNotificationsRead(userId: string) { return getDb().update(notification).set({ readAt: new Date() }).where(eq(notification.recipientUserId, userId)); }
