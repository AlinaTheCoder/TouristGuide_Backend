// controllers/HostController.js
const { db, admin } = require('../config/db'); 
const logger = require('../middleware/logger');
const { transformListedActivity } = require('../utils/Host');

exports.getAllListedActivitiesByHostId = async (req, res) => {
  try {
    const { hostId } = req.params; // Getting hostId from request parameters

    if (!hostId) {
      logger.error('[ERROR] Missing hostId in request');
      return res.status(400).json({
        success: false,
        message: 'Host ID is required.',
      });
    }

    logger.debug(`[DEBUG] Fetching activities for hostId: ${hostId}`);

    const activitiesRef = db.ref('activities');

    // Query activities based on the provided hostId
    const snapshot = await activitiesRef
      .orderByChild('hostId')
      .equalTo(hostId)
      .once('value');

    const hasListedActivities = snapshot.exists();
    const listedActivities = [];

    if (hasListedActivities) {
      snapshot.forEach((childSnapshot) => {
        const transformed = transformListedActivity(childSnapshot);
        if (transformed) {
          listedActivities.push(transformed);
        }
      });
    }

    logger.debug('[DEBUG] Listed Activities Summary:', {
      hasListedActivities,
      totalListedActivities: listedActivities.length,
    });

    return res.status(200).json({
      success: true,
      hasListedActivities,
      activitiesCount: listedActivities.length,
      data: listedActivities,
    });
  } catch (error) {
    logger.error('[HostController] Error fetching listed activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};
