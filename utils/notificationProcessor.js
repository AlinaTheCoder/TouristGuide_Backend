// utils/notificationProcessor.js
const { db, admin } = require('../config/db');
const { sendNotification } = require('../config/fcmService');
const logger = require('../middleware/logger');

/**
 * Processes and sends all pending notifications that have reached their scheduled time
 * @returns {Promise<number>} - Number of notifications processed
 */
const processScheduledNotifications = async () => {
  try {
    const now = Date.now();
    logger.info(`[NotificationProcessor] Starting scheduled notification processing at ${new Date(now).toISOString()}`);
    
    // Query for notifications that are:
    // 1. Scheduled (not cancelled)
    // 2. Due to be sent (scheduledTime <= now)
    const notificationsSnapshot = await db.ref('scheduled_notifications')
      .orderByChild('status')
      .equalTo('scheduled')
      .once('value');
    
    if (!notificationsSnapshot.exists()) {
      logger.info('[NotificationProcessor] No scheduled notifications found');
      return 0;
    }
    
    const notifications = [];
    notificationsSnapshot.forEach(childSnapshot => {
      const notification = childSnapshot.val();
      notification.id = childSnapshot.key;
      
      // Only include notifications that are due
      if (notification.scheduledTime <= now) {
        notifications.push(notification);
      }
    });
    
    logger.info(`[NotificationProcessor] Found ${notifications.length} notifications to process`);
    
    // Process each due notification
    let processedCount = 0;
    for (const notification of notifications) {
      try {
        // If this is a feedback reminder, check if feedback has already been given
        if (notification.notificationData.data?.type === 'FEEDBACK_REMINDER') {
          const { activityId, userId } = notification.notificationData.data;
          
          // Get all feedback for this activity
          const feedbackSnapshot = await db.ref(`feedback/${activityId}`).once('value');
          let hasFeedback = false;
          
          // Check if user has already given feedback
          if (feedbackSnapshot.exists()) {
            feedbackSnapshot.forEach(feedbackChild => {
              const feedback = feedbackChild.val();
              if (feedback.userId === userId) {
                hasFeedback = true;
                return true; // break the forEach loop
              }
            });
          }
          
          // Skip sending notification if feedback already given
          if (hasFeedback) {
            logger.info(`[NotificationProcessor] Skipping notification ${notification.id} as feedback already given`);
            
            // Mark as processed
            await db.ref(`scheduled_notifications/${notification.id}`).update({
              status: 'skipped',
              processedAt: admin.database.ServerValue.TIMESTAMP,
              reason: 'feedback_already_given'
            });
            
            processedCount++;
            continue;
          }
        }
        
        // Send the notification
        const { title, body, data } = notification.notificationData;
        const result = await sendNotification(notification.userId, title, body, data);
        
        // Update the notification status
        await db.ref(`scheduled_notifications/${notification.id}`).update({
          status: result.success ? 'sent' : 'failed',
          processedAt: admin.database.ServerValue.TIMESTAMP,
          result: result
        });
        
        processedCount++;
      } catch (error) {
        logger.error(`[NotificationProcessor] Error processing notification ${notification.id}:`, error);
        
        // Mark as failed
        await db.ref(`scheduled_notifications/${notification.id}`).update({
          status: 'failed',
          processedAt: admin.database.ServerValue.TIMESTAMP,
          error: error.message
        });
        
        processedCount++;
      }
    }
    
    logger.info(`[NotificationProcessor] Processed ${processedCount} notifications`);
    return processedCount;
  } catch (error) {
    logger.error('[NotificationProcessor] Error processing scheduled notifications:', error);
    throw error;
  }
};

/**
 * Cleans up old notifications (older than 30 days) with status 'sent', 'failed', or 'skipped'
 * @returns {Promise<number>} - Number of notifications cleaned up
 */
const cleanupOldNotifications = async () => {
  try {
    logger.info('[NotificationProcessor] Starting cleanup of old notifications');
    
    // Calculate timestamp for 30 days ago
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // First, find all notifications that have been processed (sent, failed, or skipped)
    // and are older than 30 days
    const oldNotificationsSnapshot = await db.ref('scheduled_notifications')
      .orderByChild('processedAt')
      .endAt(thirtyDaysAgo)
      .once('value');
    
    if (!oldNotificationsSnapshot.exists()) {
      logger.info('[NotificationProcessor] No old notifications found for cleanup');
      return 0;
    }
    
    // Prepare batch updates to delete old notifications
    const updates = {};
    let cleanupCount = 0;
    
    oldNotificationsSnapshot.forEach(childSnapshot => {
      const notification = childSnapshot.val();
      
      // Only delete if status is sent, failed, or skipped (not 'scheduled')
      if (['sent', 'failed', 'skipped'].includes(notification.status)) {
        updates[childSnapshot.key] = null; // null means delete the node
        cleanupCount++;
      }
    });
    
    // Apply all deletions in a single batch operation
    if (cleanupCount > 0) {
      await db.ref('scheduled_notifications').update(updates);
      logger.info(`[NotificationProcessor] Cleaned up ${cleanupCount} old notifications`);
    } else {
      logger.info('[NotificationProcessor] No eligible old notifications to clean up');
    }
    
    return cleanupCount;
  } catch (error) {
    logger.error('[NotificationProcessor] Error cleaning up old notifications:', error);
    throw error;
  }
};

module.exports = {
  processScheduledNotifications,
  cleanupOldNotifications
};