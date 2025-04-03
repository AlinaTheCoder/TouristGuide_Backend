// controllers/AdminSocketController.js  
const { db } = require('../config/db');  
const logger = require('../middleware/logger');

/**  
 * Listens for changes on the 'activities' node in Firebase.  
 * Filters activities to only get pending activities.
 * Emits only the 'adminPendingUpdate' event.
 */  
const setupAdminSocketListeners = (io) => {  
  const activitiesRef = db.ref('activities');

  activitiesRef.on('value', (snapshot) => {  
    let pendingActivities = [];  

    if (snapshot.exists()) {  
      snapshot.forEach((childSnapshot) => {  
        const activity = childSnapshot.val();  
        
        // Only process activities with Pending status
        if (activity.status === 'Pending') {
          // Build the structure for pending activities
          const activityInfo = {  
            id: childSnapshot.key,  
            activityTitle: activity.activityTitle,  
            createdAt: activity.createdAt,  
            images: activity.activityImages || [],  
          };
          pendingActivities.push(activityInfo);  
        }
      });  
    }

    // Emit realtime event only for pending activities
    io.emit('adminPendingUpdate', {  
      success: true,  
      data: pendingActivities,  
    });
  }, (error) => {  
    logger.error(`Error listening for admin activities: ${error}`);  
  });  
};

module.exports = { setupAdminSocketListeners };