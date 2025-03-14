// controllers/ExploreSocketController.js
const { db } = require('../config/db');
const logger = require('../middleware/logger'); 
const { filterExploreActivities } = require('../utils/Explore');

const setupExploreActivitiesListener = (io) => {
  const activitiesRef = db.ref('activities');

  activitiesRef.on('value', (snapshot) => {
    const exploreActivities = filterExploreActivities(snapshot, {
      logDebug: false,
      includeLikedStatus: false,
      defaultDateRange: {},
    });

    io.emit('exploreActivitiesUpdate', {
      success: true,
      activitiesCount: exploreActivities.length,
      data: exploreActivities,
    });
  }, (error) => {
    // Changed from console.error to logger.error
    logger.error(`Error listening for explore activities: ${error}`);
  });
};

module.exports = { setupExploreActivitiesListener };
