// controllers/TripController.js
const { db } = require('../config/db');

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
 *     host: "John Doe"
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
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ trips });
  } catch (error) {
    console.error('[getUserTrips] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
