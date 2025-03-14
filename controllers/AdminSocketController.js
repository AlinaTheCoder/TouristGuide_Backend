// controllers/AdminSocketController.js
const { db } = require('../config/db');
const logger = require('../middleware/logger'); 

/**
 * Listens for changes on the 'activities' node in Firebase.
 * Filters activities into pending, accepted, and rejected groups.
 * Emits three separate events: 'adminPendingUpdate', 'adminAcceptedUpdate', and 'adminRejectedUpdate'.
 */
const setupAdminSocketListeners = (io) => {
  const activitiesRef = db.ref('activities');

  activitiesRef.on('value', (snapshot) => {
    let pendingActivities = [];
    let acceptedActivities = [];
    let rejectedActivities = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const activity = childSnapshot.val();
        // Build a common structure for each activity
        const activityInfo = {
          id: childSnapshot.key,
          activityTitle: activity.activityTitle,
          createdAt: activity.createdAt,
          images: activity.activityImages || [],
        };

        if (activity.status === 'Pending') {
          pendingActivities.push(activityInfo);
        } else if (activity.status === 'Accepted') {
          // For accepted, we want to send a single image (first one)
          acceptedActivities.push({
            id: childSnapshot.key,
            activityTitle: activity.activityTitle,
            image: activity.activityImages ? activity.activityImages[0] : null,
          });
        } else if (activity.status === 'Rejected') {
          rejectedActivities.push({
            id: childSnapshot.key,
            activityTitle: activity.activityTitle,
            image: activity.activityImages ? activity.activityImages[0] : null,
          });
        }
      });
    }

    // Emit realtime events for each group
    io.emit('adminPendingUpdate', {
      success: true,
      data: pendingActivities,
    });

    io.emit('adminAcceptedUpdate', {
      success: true,
      data: acceptedActivities,
    });

    io.emit('adminRejectedUpdate', {
      success: true,
      data: rejectedActivities,
    });
  }, (error) => {
    // Changed from console.error to logger.error
    logger.error(`Error listening for admin activities: ${error}`);
  });
};

module.exports = { setupAdminSocketListeners };
