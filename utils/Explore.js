// utils/Explore.js
const logger = require('../middleware/logger'); // <-- Import your Winston logger

function filterExploreActivities(snapshot, options = {}) {
  if (!snapshot.exists()) {
    return [];
  }

  const {
    logDebug = false,
    includeLikedStatus = false,
    defaultDateRange,
    filterCategory = null,
  } = options;

  let activities = [];

  snapshot.forEach((childSnapshot) => {
    const activityData = childSnapshot.val();

    // 1) Check for accepted and listed
    if (activityData.status === "Accepted" && activityData.listingStatus === "List") {
      // 2) If a category was specified, skip if it doesn't match
      if (filterCategory && activityData.activityCategory !== filterCategory) {
        if (logDebug) {
          logger.debug(
            `[DEBUG] Skipping Activity: ${childSnapshot.key} (Doesn't match category: ${filterCategory})`
          );
        }
        return; // Skip
      }

      // -----------------------------------------------------------------
      // NEW LOGIC: Skip if endDate is in the past compared to "today"
      // -----------------------------------------------------------------
      if (activityData.dateRange && activityData.dateRange.endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // zero out time for a pure date comparison

        const endDate = new Date(activityData.dateRange.endDate);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < today) {
          if (logDebug) {
            logger.debug(
              `[DEBUG] Skipping Activity: ${childSnapshot.key} (endDate is in the past: ${activityData.dateRange.endDate})`
            );
          }
          return; // Skip
        }
      }

      if (logDebug) {
        logger.debug(`[DEBUG] Including Activity: ${childSnapshot.key}`);
      }

      // Build the activity object including the category
      const activity = {
        id: childSnapshot.key,
        activityImages: activityData.activityImages || [],
        activityTitle: activityData.activityTitle || 'Untitled Activity',
        dateRange:
          activityData.dateRange !== undefined
            ? activityData.dateRange
            : defaultDateRange,
        activityCategory: activityData.activityCategory || '',
      };

      if (includeLikedStatus) {
        activity.likedStatus = activityData.likedStatus || false;
      }
      activities.push(activity);

    } else {
      if (logDebug) {
        logger.debug(
          `[DEBUG] Skipping Activity: ${childSnapshot.key} (Status: ${activityData.status}, Listing Status: ${activityData.listingStatus})`
        );
      }
    }
  });

  return activities;
}

module.exports = { filterExploreActivities };
