import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database.js";
import { notifications } from "../../drizzle/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { validateQuery, validateBody, paginationSchema } from "../middleware/validation.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { apiRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwNotFound, throwForbidden } from "../middleware/error.middleware.js";
import { notificationService } from "../services/notification.service.js";

const notificationRoutes = new Hono();

// All notification routes require authentication
notificationRoutes.use("*", authMiddleware);
notificationRoutes.use("*", apiRateLimiter());

// Get user's notifications
const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  ...paginationSchema.shape,
});

notificationRoutes.get("/", validateQuery(notificationQuerySchema), async (c) => {
  const user = c.get("user");
  const query = c.req.query();
  const unreadOnly = query.unreadOnly === "true";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  let whereClause = eq(notifications.userId, user.id);
  if (unreadOnly) {
    whereClause = and(eq(notifications.userId, user.id), eq(notifications.isRead, false))!;
  }

  const userNotifications = await db
    .select()
    .from(notifications)
    .where(whereClause)
    .orderBy(desc(notifications.sentAt))
    .limit(limit)
    .offset(offset);

  // Get unread count
  const unreadCount = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

  return c.json({
    success: true,
    data: userNotifications,
    unreadCount: unreadCount.length,
    pagination: {
      page,
      limit,
      hasMore: userNotifications.length === limit,
    },
  });
});

// Get notification by ID
notificationRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const notificationId = c.req.param("id");

  const notification = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .limit(1);

  if (!notification.length) {
    throwNotFound("Notification not found");
  }

  return c.json({
    success: true,
    data: notification[0],
  });
});

// Mark notification as read
notificationRoutes.put("/:id/read", async (c) => {
  const user = c.get("user");
  const notificationId = c.req.param("id");

  const notification = await db
    .select({ id: notifications.id, userId: notifications.userId })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification.length) {
    throwNotFound("Notification not found");
  }

  if (notification[0].userId !== user.id) {
    throwForbidden("You don't have permission to update this notification");
  }

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));

  return c.json({
    success: true,
    message: "Notification marked as read",
  });
});

// Mark all notifications as read
notificationRoutes.put("/read-all", async (c) => {
  const user = c.get("user");

  await notificationService.markAllAsRead(user.id);

  return c.json({
    success: true,
    message: "All notifications marked as read",
  });
});

// Delete notification
notificationRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const notificationId = c.req.param("id");

  const notification = await db
    .select({ id: notifications.id, userId: notifications.userId })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification.length) {
    throwNotFound("Notification not found");
  }

  if (notification[0].userId !== user.id) {
    throwForbidden("You don't have permission to delete this notification");
  }

  await db.delete(notifications).where(eq(notifications.id, notificationId));

  return c.json({
    success: true,
    message: "Notification deleted",
  });
});

// Subscribe to trip alerts
const subscribeSchema = z.object({
  tripId: z.string().uuid(),
  alertTypes: z.array(z.enum([
    "delay_alert",
    "platform_change",
    "arrival_reminder",
    "departure_reminder",
  ])).min(1),
});

notificationRoutes.post("/subscribe", validateBody(subscribeSchema), async (c) => {
  const user = c.get("user");
  const { tripId, alertTypes } = await c.req.json();

  // Store subscription preferences (could be in a separate table or trip metadata)
  // For now, we'll just acknowledge the subscription

  return c.json({
    success: true,
    message: "Subscribed to alerts",
    data: {
      tripId,
      alertTypes,
    },
  });
});

// Unsubscribe from trip alerts
notificationRoutes.post("/unsubscribe", validateBody(z.object({ tripId: z.string().uuid() })), async (c) => {
  const user = c.get("user");
  const { tripId } = await c.req.json();

  return c.json({
    success: true,
    message: "Unsubscribed from alerts",
    data: {
      tripId,
    },
  });
});

// Register FCM token
notificationRoutes.post("/fcm/register", validateBody(z.object({ fcmToken: z.string().min(1) })), async (c) => {
  const user = c.get("user");
  const { fcmToken } = await c.req.json();

  await notificationService.registerFCMToken(user.id, fcmToken);

  return c.json({
    success: true,
    message: "FCM token registered",
  });
});

// Unregister FCM token
notificationRoutes.post("/fcm/unregister", async (c) => {
  const user = c.get("user");

  await notificationService.unregisterFCMToken(user.id);

  return c.json({
    success: true,
    message: "FCM token unregistered",
  });
});

export default notificationRoutes;
