// userProfileSync.js
const { db } = require('../config/db');
const logger = require('../middleware/logger');

// Setup database listeners to keep user data in sync across all references
exports.setupUserProfileSyncListeners = () => {
  const usersRef = db.ref('users');
  
  // Listen for profile image changes
  usersRef.on('child_changed', async (snapshot) => {
    try {
      const userId = snapshot.key;
      const userData = snapshot.val();
      
      // Only proceed if profile image has changed
      if (!userData.profileImage) return;
      
      logger.info(`User ${userId} updated their profile image. Syncing to feedback entries...`);
      
      // Find all feedback entries by this user across all activities
      const feedbackRef = db.ref('feedback');
      const allFeedbackSnapshot = await feedbackRef.once('value');
      const allFeedback = allFeedbackSnapshot.val() || {};
      
      // Update user profile data in all feedback entries
      const updates = {};
      
      for (const activityId in allFeedback) {
        for (const feedbackId in allFeedback[activityId]) {
          const feedback = allFeedback[activityId][feedbackId];
          
          if (feedback.userId === userId) {
            updates[`feedback/${activityId}/${feedbackId}/userProfileImage`] = userData.profileImage;
            updates[`feedback/${activityId}/${feedbackId}/userName`] = userData.name || feedback.userName;
          }
        }
      }
      
      // Apply all updates in a single batch operation
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        logger.info(`Updated ${Object.keys(updates).length} feedback entries with new profile data for user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error syncing user profile updates:`, error);
    }
  });
  
  logger.info('User profile sync listeners established');
};