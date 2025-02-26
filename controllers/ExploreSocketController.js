// controllers/ExploreSocketController.js
const { db } = require('../config/db');

const setupExploreActivitiesListener = (io) => {
  const activitiesRef = db.ref('activities');

  activitiesRef.on('value', (snapshot) => {
    let exploreActivities = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const activityData = childSnapshot.val();
        if (
          activityData.status === "Accepted" &&
          activityData.listingStatus === "List"
        ) {
          exploreActivities.push({
            id: childSnapshot.key,
            activityImages: activityData.activityImages || [],
            activityTitle: activityData.activityTitle || 'Untitled Activity',
            dateRange: activityData.dateRange || {},
          });
        }
      });
    }

    io.emit('exploreActivitiesUpdate', {
      success: true,
      activitiesCount: exploreActivities.length,
      data: exploreActivities,
    });
  }, (error) => {
    console.error('Error listening for explore activities:', error);
  });
};

module.exports = { setupExploreActivitiesListener };
