// utils/cleanupUnlistedWishlistItems.js
const { db } = require('../config/db');
const logger = require('../middleware/logger');

/**
 * Removes unlisted activities from all users' wishlists
 * @returns {Promise<number>} Number of wishlist items removed
 */
const cleanupUnlistedWishlistItems = async () => {
  try {
    logger.info('[cleanupUnlistedWishlistItems] Starting cleanup process...');
    
    // Get all wishlist entries
    const wishlistRef = db.ref('wishlist');
    const wishlistSnapshot = await wishlistRef.once('value');
    
    if (!wishlistSnapshot.exists()) {
      logger.info('[cleanupUnlistedWishlistItems] No wishlists found.');
      return 0;
    }
    
    const wishlists = wishlistSnapshot.val();
    const userIds = Object.keys(wishlists);
    
    let removedCount = 0;
    
    // Get all activities
    const activitiesRef = db.ref('activities');
    const activitiesSnapshot = await activitiesRef.once('value');
    
    if (!activitiesSnapshot.exists()) {
      logger.info('[cleanupUnlistedWishlistItems] No activities found.');
      return 0;
    }
    
    const activities = activitiesSnapshot.val();
    
    // Process each user's wishlist
    const updatePromises = [];
    
    for (const userId of userIds) {
      const userWishlist = wishlists[userId];
      const activityIds = Object.keys(userWishlist);
      
      for (const activityId of activityIds) {
        // Check if activity exists and is listed
        const activity = activities[activityId];
        
        if (!activity || activity.listingStatus !== 'List') {
          // Activity doesn't exist or is unlisted, remove from wishlist
          const removePromise = db.ref(`wishlist/${userId}/${activityId}`).remove()
            .then(() => {
              removedCount++;
              logger.info(`[cleanupUnlistedWishlistItems] Removed unlisted activity ${activityId} from user ${userId}'s wishlist`);
            });
          
          updatePromises.push(removePromise);
        }
      }
    }
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    logger.info(`[cleanupUnlistedWishlistItems] Cleanup complete. Removed ${removedCount} unlisted activities from wishlists.`);
    return removedCount;
  } catch (error) {
    logger.error(`[cleanupUnlistedWishlistItems] Error during cleanup: ${error.message}`);
    throw error;
  }
};

module.exports = { cleanupUnlistedWishlistItems };