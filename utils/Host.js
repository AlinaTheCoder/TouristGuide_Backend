// utils/Host.js
const logger = require('../middleware/logger'); 

/**
 * Transforms a host activity snapshot into an object if it meets the criteria:
 * - Status is "Accepted" AND
 * - ListingStatus is either "List" OR "Unlist"
 * Logs debug details and returns the transformed object.
 * If criteria not met, logs the skip message and returns null.
 *
 * @param {Object} childSnapshot - A Firebase snapshot for an activity.
 * @returns {Object|null} - Transformed activity object or null if criteria not met.
 */
function transformListedActivity(childSnapshot) {
  const activityData = childSnapshot.val();
  
  // Only process activities with status "Accepted" AND listingStatus either "List" OR "Unlist"
  if (activityData.status !== "Accepted" || 
      (activityData.listingStatus !== "List" && activityData.listingStatus !== "Unlist")) {
    logger.debug(
      `[DEBUG] Skipping Activity: ${childSnapshot.key}, status: ${activityData.status}, listingStatus: ${activityData.listingStatus}`
    );
    return null;
  }

  const transformed = {
    id: childSnapshot.key,
    images: activityData.activityImages || [],
    status: activityData.status,
    createdAt: activityData.createdAt,
    address: activityData.address || 'No address provided',
    city: activityData.city,
  };

  logger.debug('[DEBUG] Activity Details:', {
    ...transformed,
    listingStatus: activityData.listingStatus, // For debug purposes
  });

  return transformed;
}

module.exports = { transformListedActivity };