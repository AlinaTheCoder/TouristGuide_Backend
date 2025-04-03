// controllers/FeedbackController.js
const { db, admin } = require('../config/db');
const logger = require('../middleware/logger');

// Submit or update feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { activityId, userId, rating, text, highlights } = req.body;

    // Validation
    if (!activityId || !userId || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: activityId, userId, and rating are required' 
      });
    }

    // Get the user's data to include in feedback
    const userRef = db.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val() || {};

    // Create feedback object with updatedAt timestamp
    const feedbackData = {
      userId,
      rating,
      text: text || '',
      highlights: highlights || [],
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      userName: userData.name || '',
      userProfileImage: userData.profileImage || '',
    };

    // First, check if the feedback node for this activity exists
    const feedbackRef = db.ref(`feedback/${activityId}`);
    const feedbackSnapshot = await feedbackRef.once('value');
    
    let isUpdate = false;
    let feedbackKey = null;
    
    // If the feedback node exists, search for existing user feedback
    if (feedbackSnapshot.exists()) {
      const allFeedback = feedbackSnapshot.val();
      
      // Check each feedback entry
      for (const key in allFeedback) {
        if (allFeedback[key].userId === userId) {
          feedbackKey = key;
          isUpdate = true;
          
          // Preserve createdAt from the existing feedback
          feedbackData.createdAt = allFeedback[key].createdAt;
          break;
        }
      }
    }
    
    // Update existing feedback or create new
    if (isUpdate) {
      await feedbackRef.child(feedbackKey).update(feedbackData);
      logger.info(`Updated feedback for user ${userId} on activity ${activityId}`);
    } else {
      // For new feedback, set createdAt
      feedbackData.createdAt = admin.database.ServerValue.TIMESTAMP;
      
      // Create new feedback entry
      const newFeedbackRef = feedbackRef.push();
      feedbackKey = newFeedbackRef.key;
      await newFeedbackRef.set(feedbackData);
      
      logger.info(`Created new feedback for user ${userId} on activity ${activityId}`);
    }

    // Find and update all booking records for this user and activity to mark as having feedback
    let scheduleId = null;
    let bookingUpdated = false;

    // Query the bookings for this activity
    const bookingsSnapshot = await db.ref(`bookings/${activityId}`).once('value');
    
    if (bookingsSnapshot.exists()) {
      // Iterate through dates
      const promises = [];
      bookingsSnapshot.forEach(dateSnapshot => {
        // Skip totalGuestsForDay
        if (dateSnapshot.key === 'totalGuestsForDay') return;

        // Iterate through time slots
        dateSnapshot.forEach(timeSlotSnapshot => {
          // Skip totalGuestsBooked
          if (timeSlotSnapshot.key === 'totalGuestsBooked') return;

          // Check if there are booking records
          if (timeSlotSnapshot.hasChild('bookingRecords')) {
            // Iterate through booking records
            const bookingRecordsRef = timeSlotSnapshot.child('bookingRecords');
            
            bookingRecordsRef.forEach(bookingRecord => {
              // If this booking belongs to the user for this activity
              if (bookingRecord.val().userId === userId) {
                // Get the schedule ID before updating
                if (bookingRecord.val().feedbackReminderScheduleId) {
                  scheduleId = bookingRecord.val().feedbackReminderScheduleId;
                }
                
                // Update the booking to mark feedback as given
                const updatePath = `bookings/${activityId}/${dateSnapshot.key}/${timeSlotSnapshot.key}/bookingRecords/${bookingRecord.key}`;
                promises.push(db.ref(updatePath).update({ hasFeedback: true }));
                bookingUpdated = true;
              }
            });
          }
        });
      });

      // Wait for all updates to complete
      if (promises.length > 0) {
        await Promise.all(promises);
        logger.info(`[submitFeedback] Updated ${promises.length} booking records for activity ${activityId} by user ${userId}`);
      }
    }

    // If no booking was found, still mark feedback as successful but log a warning
    if (!bookingUpdated) {
      logger.warn(`[submitFeedback] No booking records found for activity ${activityId} by user ${userId}`);
    }

    // Recalculate average rating after update
    const updatedFeedbackSnapshot = await feedbackRef.once('value');
    const updatedFeedback = updatedFeedbackSnapshot.val() || {};
    
    let totalRating = 0;
    let count = 0;
    
    Object.values(updatedFeedback).forEach(feedback => {
      if (feedback.rating) {
        totalRating += Number(feedback.rating);
        count++;
      }
    });

    const averageRating = count > 0 ? (totalRating / count).toFixed(1) : 0;

    // Update activity with average rating
    const activityRef = db.ref(`activities/${activityId}`);
    await activityRef.update({
      averageRating,
      reviewCount: count
    });

    return res.status(200).json({
      success: true,
      message: isUpdate ? 'Feedback updated successfully' : 'Feedback submitted successfully',
      feedbackId: feedbackKey
    });
  } catch (error) {
    logger.error('[submitFeedback] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
};

// Get all feedback for an activity
exports.getActivityFeedback = async (req, res) => {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ActivityId is required' 
      });
    }

    const feedbackRef = db.ref(`feedback/${activityId}`);
    const feedbackSnapshot = await feedbackRef.once('value');
    
    if (!feedbackSnapshot.exists()) {
      return res.status(200).json({ 
        success: true, 
        feedback: [] 
      });
    }

    const feedbackData = feedbackSnapshot.val();
    
    // Convert to array and add formatted time
    const feedbackArray = Object.keys(feedbackData).map(key => ({
      id: key,
      ...feedbackData[key],
      time: formatTimeAgo(feedbackData[key].updatedAt || feedbackData[key].createdAt)
    }));
    
    // Sort by most recent first
    feedbackArray.sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      return bTime - aTime;
    });

    return res.status(200).json({
      success: true,
      feedback: feedbackArray
    });
  } catch (error) {
    logger.error('[getActivityFeedback] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
};

// Get a user's feedback for an activity
exports.getUserActivityFeedback = async (req, res) => {
  try {
    const { activityId, userId } = req.params;

    if (!activityId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ActivityId and userId are required' 
      });
    }

    const feedbackRef = db.ref(`feedback/${activityId}`);
    const feedbackSnapshot = await feedbackRef.once('value');
    
    if (!feedbackSnapshot.exists()) {
      return res.status(200).json({ 
        success: true, 
        feedback: null 
      });
    }

    const feedbackData = feedbackSnapshot.val();
    
    // Find the user's feedback
    let userFeedback = null;
    for (const key in feedbackData) {
      if (feedbackData[key].userId === userId) {
        userFeedback = {
          id: key,
          ...feedbackData[key],
          time: formatTimeAgo(feedbackData[key].updatedAt || feedbackData[key].createdAt)
        };
        break;
      }
    }

    return res.status(200).json({
      success: true,
      feedback: userFeedback
    });
  } catch (error) {
    logger.error('[getUserActivityFeedback] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
};

// Helper function to format timestamp to relative time
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert milliseconds to appropriate time unit
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return 'just now';
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diff / year);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}