// utils/CronJobs.js  
/**  
 * CronJobs.js - Central manager for all scheduled tasks  
 *  
 * This file contains all cron jobs for the application  
 * and provides a single initialization function.  
 */

const cron = require('node-cron');  
const logger = require('../middleware/logger');  
const { cleanupExpiredOTP } = require('../cleanupExpiredOTP');  
const { checkAndUnlistExpiredActivities } = require('./CheckExpiredActivities');  
const { processScheduledNotifications } = require('./notificationProcessor');  
const { cleanupUnlistedWishlistItems } = require('./cleanupUnlistedWishlistItems');

/**
 * Run activities maintenance tasks (expired activities check and wishlist cleanup)
 * @returns {Promise<{updatedCount: number, removedCount: number}>} Count of updated activities and removed wishlist items
 */
async function runActivitiesMaintenanceTasks() {
  // First check for expired activities
  let updatedCount = 0;
  try {
    logger.info('[MAINTENANCE] Running check for expired activities...');
    updatedCount = await checkAndUnlistExpiredActivities();
    logger.info(`[MAINTENANCE] Expired activities check complete. Updated ${updatedCount} activities.`);
  } catch (error) {
    logger.error(`[MAINTENANCE] Error in expired activities check: ${error.message}`);
  }

  // Then cleanup unlisted activities from wishlists
  let removedCount = 0;
  try {
    logger.info('[MAINTENANCE] Running cleanup of unlisted activities from wishlists...');
    removedCount = await cleanupUnlistedWishlistItems();
    logger.info(`[MAINTENANCE] Wishlist cleanup complete. Removed ${removedCount} unlisted activities from wishlists.`);
  } catch (error) {
    logger.error(`[MAINTENANCE] Error in wishlist cleanup: ${error.message}`);
  }

  return { updatedCount, removedCount };
}

/**  
 * Initialize all cron jobs for the application  
 */  
function initCronJobs() {  
  logger.info('[CRON] Initializing all cron jobs...');

  // ==== OTP CLEANUP (every 30 minutes) ====  
  cron.schedule('*/30 * * * *', () => {  
    logger.info('[CRON] Running cleanupExpiredOTP...');  
    cleanupExpiredOTP();  
  });

  // ==== NOTIFICATION PROCESSING (every 5 minutes) ====  
  cron.schedule('*/5 * * * *', async () => {  
    logger.info('[CRON] Running scheduled notification processor...');  
    try {  
      const processedCount = await processScheduledNotifications();  
      logger.info(`[CRON] Notification processing complete. Processed ${processedCount} notifications.`);  
    } catch (error) {  
      logger.error(`[CRON] Error in notification processor: ${error.message}`);  
    }  
  });

  // ==== ACTIVITIES MAINTENANCE (expired check and wishlist cleanup) (every 3 hours) ====
  cron.schedule('0 */3 * * *', async () => {
    logger.info('[CRON] Running activities maintenance tasks...');
    try {
      const { updatedCount, removedCount } = await runActivitiesMaintenanceTasks();
      logger.info(`[CRON] Activities maintenance complete. Updated ${updatedCount} activities, removed ${removedCount} wishlist items.`);
    } catch (error) {
      logger.error(`[CRON] Error in activities maintenance: ${error.message}`);
    }
  });

  // ==== OLD NOTIFICATIONS CLEANUP (daily at midnight) ====  
  cron.schedule('0 0 * * *', async () => {  
    logger.info('[CRON] Running daily cleanup of old notifications...');  
    try {  
      const { cleanupOldNotifications } = require('./notificationProcessor');  
      const cleanedCount = await cleanupOldNotifications();  
      logger.info(`[CRON] Notification cleanup complete. Removed ${cleanedCount} old notifications.`);  
    } catch (error) {  
      logger.error(`[CRON] Error in notification cleanup: ${error.message}`);  
    }  
  });

  logger.info('[CRON] All cron jobs initialized successfully');  
}

/**  
 * Run all startup tasks (same as cron jobs but executed immediately on server start)  
 */  
async function runStartupTasks() {  
  logger.info('[STARTUP] Running all startup tasks...');

  // Run notification processor on startup  
  try {  
    logger.info('[STARTUP] Running initial notification processor...');  
    const processedCount = await processScheduledNotifications();  
    logger.info(`[STARTUP] Initial notification processing complete. Processed ${processedCount} notifications.`);  
  } catch (error) {  
    logger.error(`[STARTUP] Error in initial notification processing: ${error.message}`);  
  }

  // Run activities maintenance tasks on startup
  try {
    logger.info('[STARTUP] Running initial activities maintenance tasks...');
    const { updatedCount, removedCount } = await runActivitiesMaintenanceTasks();
    logger.info(`[STARTUP] Initial activities maintenance complete. Updated ${updatedCount} activities, removed ${removedCount} wishlist items.`);
  } catch (error) {
    logger.error(`[STARTUP] Error in initial activities maintenance: ${error.message}`);
  }

  logger.info('[STARTUP] All startup tasks completed');  
}

/**  
 * Initialize all scheduled tasks - both cron jobs and startup tasks  
 */  
function initAllScheduledTasks() {  
  // Initialize regular cron jobs  
  initCronJobs();  
   
  // Run startup tasks  
  runStartupTasks();  
}

module.exports = { initAllScheduledTasks };