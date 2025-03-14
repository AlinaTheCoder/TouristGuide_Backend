// controllers/ExploreController.js
const logger = require('../middleware/logger');
const { db } = require('../config/db');
const { filterExploreActivities } = require('../utils/Explore');

exports.getAllListedExploreActivities = async (req, res) => {
  try {
    logger.debug('[DEBUG] Fetching all explore activities with status "Accepted" and listingStatus "List"...');
    const activitiesRef = db.ref('activities');
    const snapshot = await activitiesRef.once('value');

    if (!snapshot.exists()) {
      logger.debug('[DEBUG] No activities found in the database.');
      return res.status(200).json({
        success: true,
        message: 'No activities found.',
        data: [],
      });
    }

    // 1) Grab the category (if any) from the query string
    const { category } = req.query;

    // 2) Pass it to the filterExploreActivities helper
    const exploreActivities = filterExploreActivities(snapshot, {
      logDebug: true,
      includeLikedStatus: true,
      defaultDateRange: 'No date available',
      filterCategory: category, // <-- new option
    });

    logger.debug(`[DEBUG] Total Listed Explore Activities: ${exploreActivities.length}`);

    return res.status(200).json({
      success: true,
      activitiesCount: exploreActivities.length,
      data: exploreActivities,
    });
  } catch (error) {
    logger.error('[ExploreController] Error fetching explore activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};
