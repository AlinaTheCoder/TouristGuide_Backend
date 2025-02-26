// controllers/BookingController.js
const { db, admin } = require('../config/db'); // added admin for email retrieval
const moment = require('moment'); // for date/time formatting (optional but helpful)
const stripe = require('../config/stripe');
const sendEmail = require('../config/emailService'); // import email service

// Helper function to update listingStatus if the activity is fully booked across its date range.
async function checkAndUpdateListingStatus(activityId, activity) {
  try {
    // Parse the activity's start and end dates.
    const startDate = moment(activity.dateRange.startDate, 'YYYY-MM-DD');
    const endDate = moment(activity.dateRange.endDate, 'YYYY-MM-DD');

    // Retrieve all bookings for the activity.
    const bookingsSnap = await db.ref(`bookings/${activityId}`).once('value');
    const bookingsData = bookingsSnap.val() || {};

    let fullyBooked = true;
    // Iterate through each date in the activity's date range.
    for (let m = startDate.clone(); m.isSameOrBefore(endDate, 'day'); m.add(1, 'days')) {
      const dateStr = m.format('YYYY-MM-DD');
      const dayData = bookingsData[dateStr];
      // If there's no booking for this day or the total booked guests is less than the daily maximum, it's not fully booked.
      if (!dayData || !dayData.totalGuestsForDay || dayData.totalGuestsForDay < activity.maxGuestsPerDay) {
        fullyBooked = false;
        break;
      }
    }

    // If every day is fully booked and listingStatus is "List", update it to "UnList".
    if (fullyBooked && activity.listingStatus === "List") {
      await db.ref(`activities/${activityId}`).update({ listingStatus: "UnList" });
      console.log(`[checkAndUpdateListingStatus] Activity ${activityId} fully booked. Updated listingStatus to UnList.`);
    }
  } catch (err) {
    console.error(`[checkAndUpdateListingStatus] Error: ${err.message}`);
  }
}

// New helper: Given the activity details and the selected slotId (safeKey),
// this function recomputes the display label (timing) for that slot.
function getSlotDisplayLabel(activity, slotId) {
  const activityStartTime = moment(activity.startTime);
  const activityEndTime = moment(activity.endTime);
  const durationHours = parseInt(activity.duration);
  let current = activityStartTime.clone();
  while (current < activityEndTime) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(durationHours, 'hours');
    if (slotEnd > activityEndTime) break;
    const labelStart = slotStart.format("h:mm A")
      .replace("AM", "a.m.")
      .replace("PM", "p.m.");
    const labelEnd = slotEnd.format("h:mm A")
      .replace("AM", "a.m.")
      .replace("PM", "p.m.");
    const displayLabel = `${labelStart} - ${labelEnd}`;
    const safeKey = displayLabel
      .replace(/\./g, '')
      .replace(/\s+/g, '_')
      .replace(/:/g, '-')
      .replace(/__+/g, '_');
    if (safeKey === slotId) {
      return displayLabel;
    }
    current = slotEnd;
  }
  return "";
}

exports.createPaymentIntent = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { date, slotId, requestedGuests, userId } = req.body;

    if (!date || !slotId || !requestedGuests || !userId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Fetch activity details to get price per guest
    const activitySnap = await db.ref(`activities/${activityId}`).once('value');
    if (!activitySnap.exists()) {
      return res.status(404).json({ success: false, message: "Activity not found." });
    }
    const activity = activitySnap.val();
    const totalAmount = activity.pricePerGuest * requestedGuests * 100; // Stripe expects cents

    console.log(`[createPaymentIntent] Amount: ${totalAmount}`);

    // Create PaymentIntent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'pkr',
      metadata: { activityId, userId, date, slotId, requestedGuests }
    });

    console.log(`[createPaymentIntent] Payment Intent created: ${paymentIntent.id}`);

    return res.status(200).json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error("[createPaymentIntent] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create PaymentIntent",
      error: error.message
    });
  }
};

/**
 * Generate or return available time slots for a given activity and date,
 * optionally filtering by requestedGuests, including dayFullyBooked logic.
 * 12-hour format with a.m./p.m., and a safeKey for Firebase.
 */
exports.getTimeSlotsForDate = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { date, requestedGuests } = req.query;

    console.log('[getTimeSlotsForDate] activityId:', activityId, '| date:', date, '| requestedGuests:', requestedGuests);

    if (!date) {
      console.log('[getTimeSlotsForDate] Missing date param.');
      return res.status(400).json({
        success: false,
        message: "Date query parameter is required (YYYY-MM-DD).",
      });
    }

    // 1) Read activity
    const snapshot = await db.ref(`activities/${activityId}`).once('value');
    if (!snapshot.exists()) {
      console.log('[getTimeSlotsForDate] Activity not found:', activityId);
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }
    const activity = snapshot.val();
    console.log('[getTimeSlotsForDate] Activity data fetched:', activity);

    // 2) Check date range
    const startDate = moment(activity.dateRange.startDate);
    const endDate = moment(activity.dateRange.endDate);
    const requestedDate = moment(date, 'YYYY-MM-DD');

    if (!requestedDate.isBetween(startDate, endDate, 'day', '[]')) {
      console.log('[getTimeSlotsForDate] Date out of range:', date);
      return res.status(400).json({
        success: false,
        message: "Requested date is out of the activity's dateRange.",
      });
    }

    // 3) Generate time slots
    const activityStartTime = moment(activity.startTime);
    const activityEndTime = moment(activity.endTime);
    const durationHours = parseInt(activity.duration);

    let timeSlots = [];
    let current = activityStartTime.clone();
    while (current < activityEndTime) {
      const slotStart = current.clone();
      const slotEnd = current.clone().add(durationHours, 'hours');
      if (slotEnd > activityEndTime) break;

      const labelStart = slotStart.format("h:mm A")
        .replace("AM", "a.m.")
        .replace("PM", "p.m.");
      const labelEnd = slotEnd.format("h:mm A")
        .replace("AM", "a.m.")
        .replace("PM", "p.m.");
      const displayLabel = `${labelStart} - ${labelEnd}`;

      const safeKey = displayLabel
        .replace(/\./g, '')
        .replace(/\s+/g, '_')
        .replace(/:/g, '-')
        .replace(/__+/g, '_');

      timeSlots.push({ displayLabel, safeKey });
      current = slotEnd;
    }

    // 4) Check existing bookings
    const bookingsSnap = await db.ref(`bookings/${activityId}/${date}`).once('value');
    const bookingsData = bookingsSnap.val() || {};

    let results = timeSlots.map(({ displayLabel, safeKey }) => {
      const slotBooking = bookingsData[safeKey];
      const booked = slotBooking?.totalGuestsBooked || 0;
      const remaining = Math.max(activity.maxGuestsPerTime - booked, 0);
      return {
        slotId: safeKey,
        display: displayLabel,
        totalGuestsBooked: booked,
        remaining
      };
    });

    // is the entire day fully booked?
    const totalGuestsForDay = bookingsData.totalGuestsForDay || 0;
    const dayFullyBooked = totalGuestsForDay >= activity.maxGuestsPerDay;
    if (dayFullyBooked) {
      results = []; // empty if fully booked
    }

    // filter slots by requestedGuests if provided
    if (requestedGuests) {
      const neededGuests = parseInt(requestedGuests, 10);
      if (!isNaN(neededGuests) && neededGuests > 0) {
        results = results.filter(slot => slot.remaining >= neededGuests);
      }
    }

    console.log('[getTimeSlotsForDate] Final slot results:', results);

    return res.status(200).json({
      success: true,
      data: {
        timeSlots: results,
        totalGuestsForDay,
        remainingDayCapacity: Math.max(activity.maxGuestsPerDay - totalGuestsForDay, 0),
        maxGuestsPerDay: activity.maxGuestsPerDay,
        dayFullyBooked
      },
    });
  } catch (error) {
    console.error('[getTimeSlotsForDate] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

exports.bookTimeSlot = async (req, res) => {
  try {
    console.log('[bookTimeSlot] Request body =>', req.body);

    const { activityId } = req.params;
    const { date, slotId, requestedGuests, userId, paymentIntentId } = req.body;

    if (!date || !slotId || !requestedGuests || !userId || !paymentIntentId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    console.log(`[bookTimeSlot] Verifying PaymentIntent: ${paymentIntentId}`);

    // 1) Retrieve PaymentIntent from Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!paymentIntent) {
        return res.status(400).json({ success: false, message: "Invalid PaymentIntent ID." });
      }
    } catch (error) {
      console.error("[bookTimeSlot] Error fetching PaymentIntent:", error);
      return res.status(500).json({ success: false, message: "Error verifying payment." });
    }

    // 2) Check Payment Status
    const validStatuses = ['succeeded', 'processing', 'requires_capture'];
    if (!validStatuses.includes(paymentIntent.status)) {
      console.log(`[bookTimeSlot] Payment status is '${paymentIntent.status}', booking cannot proceed.`);
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Current status: ${paymentIntent.status}`,
      });
    }

    console.log(`[bookTimeSlot] Payment verified successfully with status '${paymentIntent.status}'. Finalizing booking...`);

    // 3) Fetch activity details
    const activitySnap = await db.ref(`activities/${activityId}`).once('value');
    if (!activitySnap.exists()) {
      return res.status(404).json({ success: false, message: "Activity not found." });
    }
    const activity = activitySnap.val();

    // 4) Finalize booking with a transaction
    const dayRef = db.ref(`bookings/${activityId}/${date}`);

    const transactionResult = await dayRef.transaction((dayData) => {
      if (!dayData) {
        dayData = { totalGuestsForDay: 0 };
      }
      if (!dayData[slotId]) {
        dayData[slotId] = { totalGuestsBooked: 0, bookingRecords: {} };
      }

      const currentSlotGuests = dayData[slotId].totalGuestsBooked;
      const currentDayGuests = dayData.totalGuestsForDay;

      if (currentSlotGuests + requestedGuests > activity.maxGuestsPerTime) {
        console.log(`[bookTimeSlot] Slot is full. Booking rejected.`);
        return; // transaction fails
      }
      if (currentDayGuests + requestedGuests > activity.maxGuestsPerDay) {
        console.log(`[bookTimeSlot] Max daily guests reached. Booking rejected.`);
        return;
      }

      dayData[slotId].totalGuestsBooked += requestedGuests;
      dayData.totalGuestsForDay += requestedGuests;

      const bookingId = db.ref().push().key;
      dayData[slotId].bookingRecords[bookingId] = {
        bookingId,
        userId,
        activityId,
        requestedGuests,
        createdAt: new Date().toISOString(),
        paymentIntentId,
      };

      return dayData;
    });

    if (!transactionResult.committed) {
      console.log(`[bookTimeSlot] Transaction failed due to overbooking.`);
      return res.status(400).json({ success: false, message: "Slot fully booked. Please choose another." });
    }

    // 5) Check and update listingStatus if needed
    await checkAndUpdateListingStatus(activityId, activity);

    // 6) Send confirmation email
    try {
      const userRecord = await admin.auth().getUser(userId);
      if (userRecord && userRecord.email) {
        // fetch user data from "users" node
        const userSnapshot = await db.ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();
        const userName = (userData && userData.name) ? userData.name : "Customer";
        const slotLabel = getSlotDisplayLabel(activity, slotId) || "Timing not available";

        const emailResponse = await sendEmail({
          to: userRecord.email,
          subject: 'Booking Confirmation',
          text: `Dear ${userName},
Your booking for "${activity.activityTitle}" on ${date} at ${slotLabel} has been confirmed.
Address: ${activity.address}
Hosted By: ${activity.hostName}
Number of Guests: ${requestedGuests}
Thank you for booking with us!`,
          html: `<p>Dear ${userName},</p>
<p>Your booking for <strong>${activity.activityTitle}</strong> on <strong>${date}</strong> at <strong>${slotLabel}</strong> has been confirmed.</p>
<p><strong>Address:</strong> ${activity.address}</p>
<p><strong>Hosted By:</strong> ${activity.hostName}</p>
<p><strong>Number of Guests:</strong> ${requestedGuests}</p>
<p>Thank you for booking with us!</p>`
        });
        if (!emailResponse.success) {
          console.error('[bookTimeSlot] Booking confirmation email sending failed:', emailResponse.error);
        } else {
          console.log('[bookTimeSlot] Booking confirmation email sent successfully.');
        }
      }
    } catch (emailErr) {
      console.error('[bookTimeSlot] Error retrieving user email or sending email:', emailErr);
    }

    console.log('[bookTimeSlot] Booking confirmed!');
    return res.status(200).json({
      success: true,
      message: "Booking successful!",
    });

  } catch (error) {
    console.error('[bookTimeSlot] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
