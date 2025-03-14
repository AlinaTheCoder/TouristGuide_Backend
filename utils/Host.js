// utils/Host.js
const logger = require('../middleware/logger'); 

/**
 * Transforms a host activity snapshot into an object if it is a "List" activity.
 * Logs debug details and returns the transformed object.
 * If the activity is not "List", logs the skip message and returns null.
 *
 * @param {Object} childSnapshot - A Firebase snapshot for an activity.
 * @returns {Object|null} - Transformed activity object or null if not a "List" activity.
 */
function transformListedActivity(childSnapshot) {
  const activityData = childSnapshot.val();
  if (activityData.listingStatus !== "List") {
    logger.debug(
      `[DEBUG] Skipping Non-List Activity: ${childSnapshot.key}, listingStatus: ${activityData.listingStatus}`
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
