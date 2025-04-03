// utils/CronJobs.js (updated)
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
const { cleanupUnlistedWishlistItems } = require('./cleanupUnlistedWishlistItems');
const { sendFeedbackReminders } = require('./SendFeedbackReminders'); // Add this import

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
 * Run feedback reminder task
 * @returns {Promise<number>} Number of feedback reminder emails sent
 */
async function runFeedbackReminderTask() {
  try {
    logger.info('[MAINTENANCE] Running feedback reminder task...');
    const emailsSent = await sendFeedbackReminders();
    logger.info(`[MAINTENANCE] Feedback reminder task complete. Sent ${emailsSent} reminder emails.`);
    return emailsSent;
  } catch (error) {
    logger.error(`[MAINTENANCE] Error in feedback reminder task: ${error.message}`);
    return 0;
  }
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

  // ==== FEEDBACK REMINDERS (hourly) ====
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Running feedback reminder task...');
    try {
      const emailsSent = await runFeedbackReminderTask();
      logger.info(`[CRON] Feedback reminder task complete. Sent ${emailsSent} reminder emails.`);
    } catch (error) {
      logger.error(`[CRON] Error in feedback reminder task: ${error.message}`);
    }
  });

  logger.info('[CRON] All cron jobs initialized successfully');
}

/**
 * Run all startup tasks (same as cron jobs but executed immediately on server start)
 */
async function runStartupTasks() {
  logger.info('[STARTUP] Running all startup tasks...');

  // Run activities maintenance tasks on startup
  try {
    logger.info('[STARTUP] Running initial activities maintenance tasks...');
    const { updatedCount, removedCount } = await runActivitiesMaintenanceTasks();
    logger.info(`[STARTUP] Initial activities maintenance complete. Updated ${updatedCount} activities, removed ${removedCount} wishlist items.`);
  } catch (error) {
    logger.error(`[STARTUP] Error in initial activities maintenance: ${error.message}`);
  }

  // Run feedback reminder task on startup
  try {
    logger.info('[STARTUP] Running initial feedback reminder task...');
    const emailsSent = await runFeedbackReminderTask();
    logger.info(`[STARTUP] Initial feedback reminder task complete. Sent ${emailsSent} reminder emails.`);
  } catch (error) {
    logger.error(`[STARTUP] Error in initial feedback reminder task: ${error.message}`);
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