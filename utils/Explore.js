// utils/Explore.js
//startDate < today
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
          console.log(
            `[DEBUG] Skipping Activity: ${childSnapshot.key} (Doesn't match category: ${filterCategory})`
          );
        }
        return; // Skip
      }

      // -----------------------------------------------------------------
      // NEW LOGIC: Skip if startDate is in the past compared to "today"
      // -----------------------------------------------------------------
      // We'll assume you only want to filter out if dateRange + startDate exist.
      // If dateRange is missing or has no startDate, we let it pass (to avoid
      // disturbing your existing "defaultDateRange" usage).
      if (
        activityData.dateRange &&
        activityData.dateRange.startDate
      ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // zero out time for a pure date comparison

        const startDate = new Date(activityData.dateRange.startDate);
        startDate.setHours(0, 0, 0, 0);

        if (startDate < today) {
          if (logDebug) {
            console.log(
              `[DEBUG] Skipping Activity: ${childSnapshot.key} (startDate is in the past: ${activityData.dateRange.startDate})`
            );
          }
          return; // Skip
        }
      }
      // -----------------------------------------------------------------

      if (logDebug) {
        console.log(`[DEBUG] Including Activity: ${childSnapshot.key}`);
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
        console.log(
          `[DEBUG] Skipping Activity: ${childSnapshot.key} (Status: ${activityData.status}, Listing Status: ${activityData.listingStatus})`
        );
      }
    }
  });

  return activities;
}

module.exports = { filterExploreActivities };
