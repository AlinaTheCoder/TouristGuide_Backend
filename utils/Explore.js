// utils/Explore.js
function filterExploreActivities(snapshot, options = {}) {
  if (!snapshot.exists()) {
    return [];
  }

  const {
    logDebug = false,
    includeLikedStatus = false,
    defaultDateRange,
    filterCategory = null, // new field for filtering by category
  } = options;

  let activities = [];

  snapshot.forEach((childSnapshot) => {
    const activityData = childSnapshot.val();

    // Check for accepted and listed activities
    if (activityData.status === "Accepted" && activityData.listingStatus === "List") {
      // If filterCategory is provided, skip if the activityCategory doesn't match
      if (filterCategory && activityData.activityCategory !== filterCategory) {
        if (logDebug) {
          console.log(
            `[DEBUG] Skipping Activity: ${childSnapshot.key} (Doesn't match category: ${filterCategory})`
          );
        }
        return; // Skip this iteration
      }

      if (logDebug) {
        console.log(`[DEBUG] Including Activity: ${childSnapshot.key}`);
      }

      // Build the activity object including activityCategory
      const activity = {
        id: childSnapshot.key,
        activityImages: activityData.activityImages || [],
        activityTitle: activityData.activityTitle || 'Untitled Activity',
        dateRange:
          activityData.dateRange !== undefined
            ? activityData.dateRange
            : defaultDateRange,
        activityCategory: activityData.activityCategory || '', // include the category
      };

      if (includeLikedStatus) {
        activity.likedStatus = activityData.likedStatus || false;
      }

      activities.push(activity);
    } else {
      if (logDebug) {
        console.log(
          `[DEBUG] Skipping Activity: ${childSnapshot.key} (Status: ${activityData.status}, Listing Status: ${activityData.listingStatus})`
        );
      }
    }
  });

  return activities;
}

module.exports = { filterExploreActivities };
