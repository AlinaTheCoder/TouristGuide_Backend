// config/fcmService.js
const { admin } = require('./db');
const logger = require('../middleware/logger');

/**
 * Sends a push notification to a specific user
 * @param {string} userId - Target user's ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {Object} data - Additional data to send with notification
 * @returns {Promise<Object>} - Response with success status
 */
const sendNotification = async (userId, title, body, data = {}) => {
  try {
    // Get the user's FCM token from the database
    const userSnapshot = await admin.database().ref(`users/${userId}/fcmToken`).once('value');
    const fcmToken = userSnapshot.val();

    // If no token found, log and return early
    if (!fcmToken) {
      logger.warn(`[FCM] No FCM token found for user ${userId}`);
      return { success: false, error: 'No FCM token found for user' };
    }

    // Prepare the message
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Standard action for handling notification clicks
      },
      token: fcmToken,
      android: {
        priority: 'high',
        notification: {
          channelId: 'feedback_reminders',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        }
      }
    };

    // Send the message
    const response = await admin.messaging().send(message);
    logger.info(`[FCM] Notification sent successfully to ${userId}, messageId: ${response}`);
    
    return { success: true, messageId: response };
  } catch (error) {
    logger.error(`[FCM] Error sending notification to ${userId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule a notification to be sent at a specific time
 * @param {string} userId - Target user's ID
 * @param {number} scheduledTime - Timestamp when notification should be sent
 * @param {Object} notificationData - Notification content
 * @returns {Promise<Object>} - Response with scheduled task ID
 */
const scheduleNotification = async (userId, scheduledTime, notificationData) => {
  try {
    // Create a record in the scheduled_notifications collection
    const newScheduleRef = admin.database().ref('scheduled_notifications').push();
    
    await newScheduleRef.set({
      userId,
      scheduledTime,
      notificationData,
      status: 'scheduled',
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    
    logger.info(`[FCM] Notification scheduled for user ${userId} at ${new Date(scheduledTime).toISOString()}`);
    return { success: true, scheduleId: newScheduleRef.key };
  } catch (error) {
    logger.error(`[FCM] Error scheduling notification for ${userId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a previously scheduled notification
 * @param {string} scheduleId - ID of the scheduled notification
 * @returns {Promise<Object>} - Response with success status
 */
const cancelScheduledNotification = async (scheduleId) => {
  try {
    const scheduleRef = admin.database().ref(`scheduled_notifications/${scheduleId}`);
    
    // Check if the schedule exists
    const snapshot = await scheduleRef.once('value');
    if (!snapshot.exists()) {
      return { success: false, error: 'Scheduled notification not found' };
    }
    
    // Update status to cancelled
    await scheduleRef.update({
      status: 'cancelled',
      cancelledAt: admin.database.ServerValue.TIMESTAMP
    });
    
    logger.info(`[FCM] Notification ${scheduleId} cancelled successfully`);
    return { success: true };
  } catch (error) {
    logger.error(`[FCM] Error cancelling notification ${scheduleId}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendNotification,
  scheduleNotification,
  cancelScheduledNotification
};