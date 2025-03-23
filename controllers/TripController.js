// controllers/TripController.js
const { db, admin } = require('../config/db');
const logger = require('../middleware/logger');

/**
 * Convert dateKey like "2025-03-27" -> "Nov 27, 2025"
 */
function formatDateKey(dateKey) {
  if (!dateKey) return '';
  const parts = dateKey.split('-'); // e.g. ["2025","03","27"]
  if (parts.length !== 3) return dateKey;
  const [year, month, day] = parts.map(Number);
  const dateObj = new Date(year, month - 1, day);
  if (isNaN(dateObj.getTime())) return dateKey;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Convert timeSlot like "6-00_am_-_10-00_am" -> { startTime: "6:00 AM", endTime: "10:00 AM" }
 */
function parseTimeSlot(timeSlot) {
  if (!timeSlot) {
    return { startTime: '', endTime: '' };
  }
  // e.g. "6-00_am_-_10-00_am" -> split on "_-_"
  const [rawStart, rawEnd] = timeSlot.split('_-_');
  if (!rawEnd) {
    // If we don't find both parts, just return as fallback
    return { startTime: timeSlot, endTime: '' };
  }

  // Helper to transform "6-00_am" -> "6:00 AM"
  const formatPart = (raw) => {
    return raw
      .replace('-', ':')   // "6-00_am" -> "6:00_am"
      .replace('_', ' ')   // "6:00_am" -> "6:00 am"
      .toUpperCase();      // -> "6:00 AM"
  };

  return {
    startTime: formatPart(rawStart),
    endTime: formatPart(rawEnd),
  };
}

/**
 * Create a Date object from a dateKey and the start time portion of timeSlotKey
 */
function createDateTimeObject(dateKey, timeSlotKey) {
  try {
    if (!dateKey || !timeSlotKey) return null;
    
    // Parse the date parts
    const dateParts = dateKey.split('-'); // ["2025", "03", "27"]
    if (dateParts.length !== 3) return null;
    
    // Parse the time part (take only the start time)
    const startTimePart = timeSlotKey.split('_-_')[0]; // "6-00_am"
    if (!startTimePart) return null;
    
    // Remove the underscore and extract time parts
    const timeString = startTimePart.replace('_', ' '); // "6-00 am"
    const timeParts = timeString.split('-'); // ["6", "00 am"]
    if (timeParts.length !== 2) return null;
    
    const hours = parseInt(timeParts[0], 10);
    const minutesPeriod = timeParts[1]; // "00 am"
    const minutes = parseInt(minutesPeriod, 10);
    const isPM = minutesPeriod.toLowerCase().includes('pm');
    
    // Create the date object
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateParts[2], 10);
    
    const date = new Date(year, month, day);
    
    // Set the time (adjusting for PM)
    let adjustedHours = hours;
    if (isPM && hours < 12) {
      adjustedHours += 12;
    } else if (!isPM && hours === 12) {
      adjustedHours = 0;
    }
    
    date.setHours(adjustedHours, minutes, 0, 0);
    return date;
  } catch (error) {
    logger.error(`Error parsing datetime from ${dateKey} and ${timeSlotKey}:`, error);
    return null;
  }
}

/**
 * GET /trips/user/:userId
 * Returns an array "trips" with each item:
 *   {
 *     id: <activityKey>,
 *     image: <firstImage>,
 *     title: <activityTitle>,
 *     bookingDate: "Nov 27, 2025",
 *     startTime: "6:00 AM",
 *     endTime: "10:00 AM",
 *     price: "Rs. 5000",
 *     guests: "2 guests",
 *     host: "John Doe",
 *     rawBookingDate: "2025-03-27",
 *     rawTimeSlot: "6-00_am_-_10-00_am",
 *     reviewEligibleTimestamp: 1679554800000, // Unix timestamp when review becomes eligible
 *     bookingRecordId: <recordKey>,
 *     hasFeedback: <boolean>
 *   }
 */
exports.getUserTrips = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1) Fetch all activities
    const activitiesSnap = await db.ref('activities').once('value');
    const activitiesData = activitiesSnap.exists() ? activitiesSnap.val() : {};

    // 2) Fetch bookings
    const bookingsSnap = await db.ref('bookings').once('value');
    if (!bookingsSnap.exists()) {
      return res.status(200).json({ trips: [] });
    }
    const allBookings = bookingsSnap.val();

    // 3) Fetch user feedback to check which activities already have feedback
    const feedbackSnap = await db.ref('feedback').once('value');
    const allFeedback = feedbackSnap.exists() ? feedbackSnap.val() : {};

    // Map to track activities for which the user has already submitted feedback
    const feedbackSubmitted = {};
    
    // Check each activity's feedback
    for (const activityId in allFeedback) {
      const activityFeedback = allFeedback[activityId];
      
      // Check each feedback entry
      for (const feedbackId in activityFeedback) {
        const feedback = activityFeedback[feedbackId];
        
        // If feedback is from this user, mark it
        if (feedback.userId === userId) {
          feedbackSubmitted[activityId] = true;
          break;
        }
      }
    }

    const trips = [];

    // Structure: bookings / <activityKey> / <dateKey> / <timeSlotKey> / bookingRecords / <recordKey>
    for (const activityKey of Object.keys(allBookings)) {
      const activityBookings = allBookings[activityKey];

      for (const dateKey of Object.keys(activityBookings)) {
        const dateData = activityBookings[dateKey];

        for (const timeSlotKey of Object.keys(dateData)) {
          const slotData = dateData[timeSlotKey];
          if (!slotData.bookingRecords) continue;

          const bookingRecordsObj = slotData.bookingRecords;
          for (const recordKey of Object.keys(bookingRecordsObj)) {
            const record = bookingRecordsObj[recordKey];

            // If it belongs to this user
            if (record.userId === userId) {
              const activityObj = activitiesData[activityKey] || {};

              // Host name
              let hostName = 'Unknown Host';
              if (activityObj.hostName) {
                hostName = activityObj.hostName;
              } else if (activityObj.accountHolderName) {
                hostName = activityObj.accountHolderName;
              }

              // Convert dateKey -> "Nov 27, 2025"
              const bookingDate = formatDateKey(dateKey);

              // Parse time slot -> { startTime, endTime }
              const { startTime, endTime } = parseTimeSlot(timeSlotKey);

              // Price => "Rs. 5000"
              const pricePerGuest = activityObj.pricePerGuest || '0';
              const price = `Rs. ${pricePerGuest}`;

              // guests => "2 guests"
              const guestsCount = record.totalGuestsBooked ?? record.requestedGuests ?? 1;
              const guests = guestsCount === 1 ? '1 guest' : `${guestsCount} guests`;

              // image => first activity image
              const activityImage = (activityObj.activityImages && activityObj.activityImages[0]) || '';

              // title => activityTitle
              const activityTitle = activityObj.activityTitle || 'Untitled';

              // Create a Date object from the booking date and start time
              const bookingDateTime = createDateTimeObject(dateKey, timeSlotKey);
              
              // Calculate when review becomes eligible (24 hours after booking)
              let reviewEligibleTimestamp = null;
              if (bookingDateTime) {
                // Add 24 hours to the booking time
                reviewEligibleTimestamp = bookingDateTime.getTime() + (24 * 60 * 60 * 1000);
              }

              // Add information about whether feedback has been submitted
              const hasFeedback = feedbackSubmitted[activityKey] === true;

              trips.push({
                id: activityKey,
                image: activityImage,
                title: activityTitle,
                bookingDate,
                startTime,
                endTime,
                price,
                guests,
                host: hostName,
                rawBookingDate: dateKey,
                rawTimeSlot: timeSlotKey,
                reviewEligibleTimestamp,
                bookingRecordId: recordKey,
                hasFeedback
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ trips });
  } catch (error) {
    logger.error('[getUserTrips] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};