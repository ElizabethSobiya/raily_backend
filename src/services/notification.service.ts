import { db } from "../config/database.js";
import { notifications, users, trips } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { NOTIFICATION_TYPES } from "../utils/constants.js";

// Firebase Admin would be initialized here in production
// import admin from "firebase-admin";

export interface NotificationPayload {
  userId: string;
  tripId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class NotificationService {
  /**
   * Send push notification to user
   */
  async sendPushNotification(userId: string, notification: PushNotificationData): Promise<boolean> {
    try {
      // Get user's FCM token
      const user = await db
        .select({ fcmToken: users.fcmToken })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || !user[0].fcmToken) {
        logger.warn({ userId }, "User has no FCM token");
        return false;
      }

      // In production, send via Firebase
      // await admin.messaging().send({
      //   token: user[0].fcmToken,
      //   notification: {
      //     title: notification.title,
      //     body: notification.body,
      //   },
      //   data: notification.data,
      //   android: {
      //     priority: "high",
      //     notification: { sound: "default" },
      //   },
      //   apns: {
      //     payload: {
      //       aps: { sound: "default", badge: 1 },
      //     },
      //   },
      // });

      logger.info({ userId, title: notification.title }, "Push notification sent");
      return true;
    } catch (error) {
      logger.error({ error, userId }, "Failed to send push notification");
      return false;
    }
  }

  /**
   * Create notification in database and optionally send push
   */
  async createNotification(payload: NotificationPayload, sendPush: boolean = true): Promise<string> {
    try {
      const [notification] = await db
        .insert(notifications)
        .values({
          userId: payload.userId,
          tripId: payload.tripId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          metadata: payload.metadata,
        })
        .returning({ id: notifications.id });

      if (sendPush) {
        await this.sendPushNotification(payload.userId, {
          title: payload.title,
          body: payload.message,
          data: {
            type: payload.type,
            notificationId: notification.id,
            ...(payload.tripId && { tripId: payload.tripId }),
          },
        });
      }

      return notification.id;
    } catch (error) {
      logger.error({ error, payload }, "Failed to create notification");
      throw error;
    }
  }

  /**
   * Send delay alert notification
   */
  async sendDelayAlert(
    userId: string,
    tripId: string,
    trainName: string,
    delayMinutes: number
  ): Promise<void> {
    const delayText =
      delayMinutes >= 60
        ? `${Math.floor(delayMinutes / 60)}h ${delayMinutes % 60}m`
        : `${delayMinutes} minutes`;

    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.DELAY_ALERT,
      title: `${trainName} Delayed`,
      message: `Your train is running ${delayText} late`,
      metadata: { delayMinutes },
    });

    // Mark trip as delay alert sent
    await db.update(trips).set({ delayAlertSent: true }).where(eq(trips.id, tripId));
  }

  /**
   * Send platform change notification
   */
  async sendPlatformChange(
    userId: string,
    tripId: string,
    trainName: string,
    stationName: string,
    oldPlatform: string,
    newPlatform: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.PLATFORM_CHANGE,
      title: "Platform Changed",
      message: `${trainName} at ${stationName}: Platform changed from ${oldPlatform} to ${newPlatform}`,
      metadata: { oldPlatform, newPlatform, stationName },
    });
  }

  /**
   * Send arrival reminder notification
   */
  async sendArrivalReminder(
    userId: string,
    tripId: string,
    trainName: string,
    stationName: string,
    minutesAway: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.ARRIVAL_REMINDER,
      title: "Arriving Soon",
      message: `${trainName} will arrive at ${stationName} in ${minutesAway} minutes`,
      metadata: { minutesAway, stationName },
    });
  }

  /**
   * Send departure reminder notification
   */
  async sendDepartureReminder(
    userId: string,
    tripId: string,
    trainName: string,
    stationName: string,
    minutesUntil: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.DEPARTURE_REMINDER,
      title: "Departure Reminder",
      message: `${trainName} departs from ${stationName} in ${minutesUntil} minutes`,
      metadata: { minutesUntil, stationName },
    });
  }

  /**
   * Send PNR status update notification
   */
  async sendPNRUpdate(
    userId: string,
    tripId: string,
    pnr: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.PNR_UPDATE,
      title: "PNR Status Updated",
      message: `PNR ${pnr}: Status changed from ${oldStatus} to ${newStatus}`,
      metadata: { pnr, oldStatus, newStatus },
    });
  }

  /**
   * Send train cancellation notification
   */
  async sendTrainCancelled(
    userId: string,
    tripId: string,
    trainName: string,
    journeyDate: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      tripId,
      type: NOTIFICATION_TYPES.TRAIN_CANCELLED,
      title: "Train Cancelled",
      message: `${trainName} on ${journeyDate} has been cancelled`,
      metadata: { journeyDate },
    });
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.sentAt)
      .limit(limit)
      .offset(offset);

    return result;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    return true;
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  /**
   * Register FCM token for user
   */
  async registerFCMToken(userId: string, fcmToken: string): Promise<void> {
    await db.update(users).set({ fcmToken }).where(eq(users.id, userId));
    logger.info({ userId }, "FCM token registered");
  }

  /**
   * Unregister FCM token for user
   */
  async unregisterFCMToken(userId: string): Promise<void> {
    await db.update(users).set({ fcmToken: null }).where(eq(users.id, userId));
    logger.info({ userId }, "FCM token unregistered");
  }
}

export const notificationService = new NotificationService();
export default notificationService;
