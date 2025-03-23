// utils/checkExpiredActivities.js
const { db } = require('../config/db');
const moment = require('moment');
const logger = require('../middleware/logger');

/**
 * This function checks all activities and unlists those that have reached their end date
 * and have no available slots for today.
 */
async function checkAndUnlistExpiredActivities() {
  try {
    logger.info('[checkExpiredActivities] Starting check for expired activities');
    
    // Get all activities
    const activitiesSnapshot = await db.ref('activities').once('value');
    
    if (!activitiesSnapshot.exists()) {
      logger.info('[checkExpiredActivities] No activities found in database');
      return 0;
    }
    
    // Today's date (at start of day)
    const today = moment().startOf('day');
    const todayStr = today.format('YYYY-MM-DD');
    
    logger.info(`[checkExpiredActivities] Running check for today: ${todayStr}`);
    
    // Counter for updated activities
    let updatedCount = 0;
    
    // Process each activity
    const activities = activitiesSnapshot.val();
    for (const activityId in activities) {
      try {
        const activity = activities[activityId];
        
        // Skip if already unlisted
        if (activity.listingStatus !== 'List') {
          continue;
        }
        
        // Parse the end date
        const endDate = moment(activity.dateRange.endDate).startOf('day');
        
        // If today is the end date or beyond, we need to check if we should unlist
        if (today.isSameOrAfter(endDate, 'day')) {
          logger.debug(`[checkExpiredActivities] Activity ${activityId} has end date ${endDate.format('YYYY-MM-DD')} which is today or in the past`);
          
          // If today is after the end date, always unlist
          if (today.isAfter(endDate, 'day')) {
            logger.info(`[checkExpiredActivities] Unlisting activity ${activityId} because end date ${endDate.format('YYYY-MM-DD')} is in the past`);
            await db.ref(`activities/${activityId}`).update({ listingStatus: "UnList" });
            updatedCount++;
            continue;
          }
          
          // If today is the end date, check if there are available slots
          if (today.isSame(endDate, 'day')) {
            // Get available time slots for today
            const activityStartTime = moment(activity.startTime);
            const activityEndTime = moment(activity.endTime);
            const durationHours = parseInt(activity.duration);
            const currentTime = moment();
            const bufferMinutes = 30;
            const currentTimePlusBuffer = moment().add(bufferMinutes, 'minutes');
            
            let hasAvailableSlots = false;
            let current = activityStartTime.clone();
            
            // Check if there are any slots available for today
            while (current < activityEndTime) {
              const slotStart = current.clone();
              const slotEnd = current.clone().add(durationHours, 'hours');
              if (slotEnd > activityEndTime) break;
              
              // Create a moment object for today with the slot's start time
              const slotStartToday = moment()
                .hours(slotStart.hours())
                .minutes(slotStart.minutes())
                .seconds(0);
              
              // If this time hasn't passed (plus buffer), it's available
              if (!slotStartToday.isBefore(currentTimePlusBuffer)) {
                // Now check if the slot is not fully booked
                const bookingsSnap = await db.ref(`bookings/${activityId}/${todayStr}`).once('value');
                const bookingsData = bookingsSnap.val() || {};
                
                // Is the entire day fully booked?
                const totalGuestsForDay = bookingsData.totalGuestsForDay || 0;
                const dayFullyBooked = totalGuestsForDay >= activity.maxGuestsPerDay;
                
                if (!dayFullyBooked) {
                  hasAvailableSlots = true;
                  break;
                }
              }
              
              current = slotEnd;
            }
            
            // If no available slots, unlist the activity
            if (!hasAvailableSlots) {
              logger.info(`[checkExpiredActivities] Unlisting activity ${activityId} because today is the end date and no slots are available`);
              await db.ref(`activities/${activityId}`).update({ listingStatus: "UnList" });
              updatedCount++;
            }
          }
        }
      } catch (activityError) {
        logger.error(`[checkExpiredActivities] Error processing activity ${activityId}: ${activityError.message}`);
      }
    }
    
    logger.info(`[checkExpiredActivities] Completed check. Updated ${updatedCount} activities to UnList status`);
    return updatedCount;
    
  } catch (error) {
    logger.error(`[checkExpiredActivities] Error checking expired activities: ${error.message}`);
    throw error;
  }
}

module.exports = { checkAndUnlistExpiredActivities };