// controllers/ScheduleController.js
const { db, admin } = require('../config/db');
const logger = require('../middleware/logger');

/**
 * GET /schedule/host/:hostId
 * Fetch all activities belonging to a specific host
 */
exports.getHostActivities = async (req, res) => {
  const { hostId } = req.params;
  logger.debug(`[DEBUG - getHostActivities] Received request for hostId: ${hostId}`);

  try {
    const ref = db.ref('activities');
    const snapshot = await ref.orderByChild('hostId').equalTo(hostId).once('value');

    if (!snapshot.exists()) {
      logger.debug(`[DEBUG - getHostActivities] No activities found for hostId: ${hostId}`);
      return res.json([]); // Return empty array if no activities
    }

    const activitiesData = snapshot.val();

    // Convert object to an array and attach activityId
    const activitiesArray = Object.keys(activitiesData).map((key) => ({
      ...activitiesData[key],
      activityId: key,
    }));

    logger.debug(`[DEBUG - getHostActivities] Total activities fetched: ${activitiesArray.length}`);

    // Filter only activities where `status = "Accepted"` and `listingStatus = "List"`
    const acceptedActivities = activitiesArray.filter(
      (activity) => activity.status === 'Accepted' && activity.listingStatus === 'List'
    );

    logger.debug(
      `[DEBUG - getHostActivities] Accepted & Listed activities count: ${acceptedActivities.length}`
    );

    return res.json(acceptedActivities);
  } catch (error) {
    logger.error(`[ERROR - getHostActivities] ${error.message}`);
    return res.status(500).json({ error: 'Failed to fetch host activities.' });
  }
};

/**
 * GET /schedule/:activityId
 * Fetch the details of one specific activity by its ID
 */
exports.getActivityById = async (req, res) => {
  const { activityId } = req.params;
  logger.debug(`[DEBUG - getActivityById] Fetching activityId: ${activityId}`);

  try {
    const ref = db.ref(`activities/${activityId}`);
    const snapshot = await ref.once('value');

    if (!snapshot.exists()) {
      logger.debug('[DEBUG - getActivityById] Activity not found.');
      return res.status(404).json({ error: 'Activity not found.' });
    }

    const activityData = snapshot.val();
    return res.json({ ...activityData, activityId });
  } catch (error) {
    logger.error(`[ERROR - getActivityById] ${error.message}`);
    return res.status(500).json({ error: 'Failed to fetch activity details.' });
  }
};

/**
 * PUT /schedule/:activityId
 * Update an activity's schedule-related fields
 */
exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  logger.debug(`[DEBUG - updateActivity] Updating activityId: ${activityId}`);

  try {
    logger.debug(`[DEBUG - updateActivity] Request body => ${JSON.stringify(req.body)}`);

    const {
      // We nest dateRange in your FRDB, so let's handle that carefully:
      dateRange,
      startTime,
      endTime,
      duration,
      maxGuestsPerDay,
      maxGuestsPerTime,
      pricePerGuest,
      estimatedEarnings,
      listingStatus,
      address,
      city,
    } = req.body;

    const updates = {};

    // If dateRange object was sent, update dateRange/startDate + dateRange/endDate
    if (dateRange && typeof dateRange === 'object') {
      if (dateRange.startDate !== undefined) {
        updates['dateRange/startDate'] = dateRange.startDate;
      }
      if (dateRange.endDate !== undefined) {
        updates['dateRange/endDate'] = dateRange.endDate;
      }
    }

    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (duration !== undefined) updates.duration = duration;
    if (maxGuestsPerDay !== undefined) updates.maxGuestsPerDay = maxGuestsPerDay;
    if (maxGuestsPerTime !== undefined) updates.maxGuestsPerTime = maxGuestsPerTime;
    if (pricePerGuest !== undefined) updates.pricePerGuest = pricePerGuest;
    if (estimatedEarnings !== undefined) updates.estimatedEarnings = estimatedEarnings;
    if (listingStatus !== undefined) updates.listingStatus = listingStatus;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;

    if (Object.keys(updates).length === 0) {
      logger.debug('[DEBUG - updateActivity] No valid fields to update.');
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    logger.debug(`[DEBUG - updateActivity] Final updates => ${JSON.stringify(updates)}`);

    await db.ref(`activities/${activityId}`).update(updates);

    logger.debug(`[DEBUG - updateActivity] Update successful for activityId: ${activityId}`);
    return res.json({ message: 'Activity updated successfully' });
  } catch (error) {
    logger.error(`[ERROR - updateActivity] ${error.message}`);
    return res.status(500).json({ error: 'Failed to update activity.' });
  }
};
