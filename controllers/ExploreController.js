// controllers/ExploreController.js
const { db } = require('../config/db');

exports.getAllListedExploreActivities = async (req, res) => {
  try {
    console.log('[DEBUG] Fetching all explore activities with status "Accepted" and listingStatus "List"...');
    const activitiesRef = db.ref('activities');
    const snapshot = await activitiesRef.once('value');

    if (!snapshot.exists()) {
      console.log('[DEBUG] No activities found in the database.');
      return res.status(200).json({
        success: true,
        message: 'No activities found.',
        data: [],
      });
    }

    let exploreActivities = [];

    snapshot.forEach((childSnapshot) => {
      const activityData = childSnapshot.val();
      // Apply filtering conditions
      if (activityData.status === "Accepted" && activityData.listingStatus === "List") {
        console.log(`[DEBUG] Including Activity: ${childSnapshot.key}`);
        exploreActivities.push({
          id: childSnapshot.key, // activity ID
          activityImages: activityData.activityImages || [],  // Ensure images exist
          activityTitle: activityData.activityTitle || 'Untitled Activity',
          dateRange: activityData.dateRange || 'No date available',
          likedStatus: activityData.likedStatus || false // new field for liked status
        });
      } else {
        console.log(`[DEBUG] Skipping Activity: ${childSnapshot.key} (Status: ${activityData.status}, Listing Status: ${activityData.listingStatus})`);
      }
    });

    console.log(`[DEBUG] Total Listed Explore Activities: ${exploreActivities.length}`);

    return res.status(200).json({
      success: true,
      activitiesCount: exploreActivities.length,
      data: exploreActivities,
    });
  } catch (error) {
    console.error('[ExploreController] Error fetching explore activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};
