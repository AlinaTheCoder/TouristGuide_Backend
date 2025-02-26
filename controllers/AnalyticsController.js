// controllers/Analytics/AnalyticsController.js
const { db, admin } = require('../config/db');
exports.getHostBookings = async (req, res) => {
  try {
    const { hostId } = req.params;

    // A) Always fetch the host's name from the "users" node first
    let hostName = '';
    try {
      const userSnapshot = await db.ref(`users/${hostId}`).once('value');
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        hostName = userData.name || ''; // fallback to empty string if no name
      }
    } catch (err) {
      console.error('[getHostBookings] Error fetching user node:', err);
      // We'll leave hostName as ''
    }

    // 1) Find all activities for this host (to get their activityIds)
    const activitiesSnapshot = await db.ref('activities')
      .orderByChild('hostId')
      .equalTo(hostId)
      .once('value');

    let activitiesData = {};
    let activityIds = [];

    if (activitiesSnapshot.exists()) {
      activitiesData = activitiesSnapshot.val();
      activityIds = Object.keys(activitiesData);
    }

    // 2) Traverse the "bookings" node
    const bookingsSnapshot = await db.ref('bookings').once('value');
    if (!bookingsSnapshot.exists()) {
      // No bookings at all => just return the hostName (from users node) + empty array
      return res.status(200).json({ hostName, bookings: [] });
    }

    const allBookingsData = bookingsSnapshot.val();
    const bookings = [];

    // If the user has no activities, skip traversing. We'll still return { hostName, bookings: [] }
    if (activityIds.length > 0) {
      // For each activity that belongs to this host
      for (const activityKey of Object.keys(allBookingsData)) {
        if (activityIds.includes(activityKey)) {
          const activityObj = activitiesData[activityKey] || {};
          const activityLevelData = allBookingsData[activityKey];

          // Loop over dateKey -> timeSlotKey -> bookingRecords
          for (const dateKey of Object.keys(activityLevelData)) {
            const dateData = activityLevelData[dateKey];

            for (const timeSlotKey of Object.keys(dateData)) {
              const timeSlotData = dateData[timeSlotKey];
              if (!timeSlotData.bookingRecords) continue;

              const bookingRecordsObj = timeSlotData.bookingRecords;
              for (const recordKey of Object.keys(bookingRecordsObj)) {
                const record = bookingRecordsObj[recordKey];

                // Build userName from "users/<record.userId>"
                let userName = 'Anonymous User';
                try {
                  const userSnap = await db.ref(`users/${record.userId}`).once('value');
                  if (userSnap.exists()) {
                    const userData = userSnap.val();
                    userName = userData.name || 'Anonymous User';
                  } else {
                    // Optional fallback to Firebase Auth
                    const userRecord = await admin.auth().getUser(record.userId);
                    if (userRecord && userRecord.displayName) {
                      userName = userRecord.displayName;
                    }
                  }
                } catch (err) {
                  // ignore if user not found
                }

                // totalGuests
                const guestsCount = record.totalGuestsBooked ?? record.requestedGuests ?? 0;

                // Use dateKey as the booking date
                bookings.push({
                  bookingId: record.bookingId || recordKey,
                  activityId: record.activityId,
                  activityTitle: activityObj.activityTitle || 'Untitled',
                  activityImages: activityObj.activityImages || [],
                  totalGuestsBooked: guestsCount,
                  bookingDate: dateKey,    // e.g. "2025-03-27"
                  timeSlot: timeSlotKey,   // e.g. "10-00_am_-_2-00_pm"
                  userName,
                });
              }
            }
          }
        }
      }
    }

    // Return the user-based hostName + any found bookings
    return res.status(200).json({ hostName, bookings });
  } catch (error) {
    console.error('Error fetching host bookings:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
