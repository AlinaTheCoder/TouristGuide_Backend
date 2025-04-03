// controllers/BookingController.js    
const { db, admin } = require('../config/db'); // Admin for email retrieval    
const moment = require('moment'); // for date/time formatting (optional but helpful)    
const stripe = require('../config/stripe');    
const sendEmail = require('../config/emailService'); // import email service
const logger = require('../middleware/logger');

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
      // If there's no booking for this day or total booked guests is less than the daily maximum, it's not fully booked.    
      if (!dayData || !dayData.totalGuestsForDay || dayData.totalGuestsForDay < activity.maxGuestsPerDay) {    
        fullyBooked = false;    
        break;    
      }    
    }

    // If every day is fully booked and listingStatus is "List", update it to "UnList".    
    if (fullyBooked && activity.listingStatus === "List") {    
      await db.ref(`activities/${activityId}`).update({ listingStatus: "UnList" });    
      logger.info(`[checkAndUpdateListingStatus] Activity ${activityId} fully booked. Updated listingStatus to UnList.`);    
    }    
  } catch (err) {    
    logger.error(`[checkAndUpdateListingStatus] Error: ${err.message}`);    
  }    
}

// Helper: Given the activity details and the selected slotId (safeKey),    
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

    logger.debug(`[createPaymentIntent] Amount: ${totalAmount}`);

    // Create PaymentIntent in Stripe    
    const paymentIntent = await stripe.paymentIntents.create({    
      amount: totalAmount,    
      currency: 'pkr',    
      metadata: { activityId, userId, date, slotId, requestedGuests }    
    });

    logger.info(`[createPaymentIntent] Payment Intent created: ${paymentIntent.id}`);

    return res.status(200).json({    
      success: true,    
      paymentIntentId: paymentIntent.id,    
      clientSecret: paymentIntent.client_secret,    
    });    
  } catch (error) {    
    logger.error("[createPaymentIntent] Error:", error);    
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

    logger.debug(`[getTimeSlotsForDate] activityId: ${activityId} | date: ${date} | requestedGuests: ${requestedGuests}`);

    if (!date) {    
      logger.warn('[getTimeSlotsForDate] Missing date param.');    
      return res.status(400).json({    
        success: false,    
        message: "Date query parameter is required (YYYY-MM-DD).",    
      });    
    }

    // 1) Read activity    
    const snapshot = await db.ref(`activities/${activityId}`).once('value');    
    if (!snapshot.exists()) {    
      logger.warn('[getTimeSlotsForDate] Activity not found:', activityId);    
      return res.status(404).json({    
        success: false,    
        message: "Activity not found",    
      });    
    }    
    const activity = snapshot.val();    
    logger.debug('[getTimeSlotsForDate] Activity data fetched:', activity);

    // 2) Check date range    
    const startDate = moment(activity.dateRange.startDate);    
    const endDate = moment(activity.dateRange.endDate);    
    const requestedDate = moment(date, 'YYYY-MM-DD');

    if (!requestedDate.isBetween(startDate, endDate, 'day', '[]')) {    
      logger.warn('[getTimeSlotsForDate] Date out of range:', date);    
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
     
    // Check if the requested date is today  
    const isToday = moment().isSame(requestedDate, 'day');  
    const currentTime = moment();  
     
    // Define a buffer time (in minutes) to prevent booking slots too close to current time  
    const bufferMinutes = 30;  
    // Add buffer to current time  
    const currentTimePlusBuffer = moment().add(bufferMinutes, 'minutes');  
     
    while (current < activityEndTime) {    
      const slotStart = current.clone();    
      const slotEnd = current.clone().add(durationHours, 'hours');    
      if (slotEnd > activityEndTime) break;

      // If the date is today and the slot start time has already passed or is too close to current time, skip this slot  
      if (isToday) {  
        // Create a moment object for today with the slot's start time  
        const slotStartToday = moment()  
          .hours(slotStart.hours())  
          .minutes(slotStart.minutes())  
          .seconds(0);  
           
        // If this time has already passed or is within buffer period, skip this slot  
        if (slotStartToday.isBefore(currentTimePlusBuffer)) {  
          current = slotEnd;  
          continue;  
        }  
      }

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

    // Is the entire day fully booked?    
    const totalGuestsForDay = bookingsData.totalGuestsForDay || 0;    
    const dayFullyBooked = totalGuestsForDay >= activity.maxGuestsPerDay;    
    if (dayFullyBooked) {    
      results = []; // empty if fully booked    
    }

    // Filter slots by requestedGuests if provided    
    if (requestedGuests) {    
      const neededGuests = parseInt(requestedGuests, 10);    
      if (!isNaN(neededGuests) && neededGuests > 0) {    
        results = results.filter(slot => slot.remaining >= neededGuests);    
      }    
    }

    // If it's today and no valid slots remain (all slots are in the past or within buffer period), mark the day as unavailable  
    if (isToday && results.length === 0 && !dayFullyBooked) {  
      logger.info('[getTimeSlotsForDate] No available time slots remaining for today.');  
       
      // Create a custom message that clearly explains why no slots are available  
      const noSlotsMessage = `No available time slots remaining for today. ${  
        bufferMinutes > 0 ? `We require a minimum of ${bufferMinutes} minutes advance booking.` : ''  
      }`;  
       
      return res.status(200).json({  
        success: true,  
        data: {  
          timeSlots: [],  
          totalGuestsForDay,  
          remainingDayCapacity: Math.max(activity.maxGuestsPerDay - totalGuestsForDay, 0),  
          maxGuestsPerDay: activity.maxGuestsPerDay,  
          dayFullyBooked: true,  // Mark as fully booked when all of today's slots are unavailable  
          noSlotsReason: 'past_time',  // Add a specific reason code for frontend to potentially display differently  
          noSlotsMessage: noSlotsMessage  // Add a descriptive message that can be shown to the user  
        },  
      });  
    }

    logger.debug('[getTimeSlotsForDate] Final slot results:', results);

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
    logger.error('[getTimeSlotsForDate] Error:', error);    
    return res.status(500).json({    
      success: false,    
      message: 'Internal server error.',    
      error: error.message,    
    });    
  }    
};

exports.bookTimeSlot = async (req, res) => {    
  try {    
    logger.debug('[bookTimeSlot] Request body =>', req.body);

    const { activityId } = req.params;    
    const { date, slotId, requestedGuests, userId, paymentIntentId } = req.body;

    if (!date || !slotId || !requestedGuests || !userId || !paymentIntentId) {    
      return res.status(400).json({ success: false, message: "Missing required fields" });    
    }

    logger.info(`[bookTimeSlot] Verifying PaymentIntent: ${paymentIntentId}`);

    // 1) Retrieve PaymentIntent from Stripe    
    let paymentIntent;    
    try {    
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);    
      if (!paymentIntent) {    
        return res.status(400).json({ success: false, message: "Invalid PaymentIntent ID." });    
      }    
    } catch (error) {    
      logger.error("[bookTimeSlot] Error fetching PaymentIntent:", error);    
      return res.status(500).json({ success: false, message: "Error verifying payment." });    
    }

    // 2) Check Payment Status    
    const validStatuses = ['succeeded', 'processing', 'requires_capture'];    
    if (!validStatuses.includes(paymentIntent.status)) {    
      logger.warn(`[bookTimeSlot] Payment status is '${paymentIntent.status}', booking cannot proceed.`);    
      return res.status(400).json({    
        success: false,    
        message: `Payment not completed. Current status: ${paymentIntent.status}`,    
      });    
    }

    logger.info(`[bookTimeSlot] Payment verified successfully with status '${paymentIntent.status}'. Finalizing booking...`);

    // 3) Fetch activity details    
    const activitySnap = await db.ref(`activities/${activityId}`).once('value');    
    if (!activitySnap.exists()) {    
      return res.status(404).json({ success: false, message: "Activity not found." });    
    }    
    const activity = activitySnap.val();

    // 4) Generate the bookingId outside of the transaction so we can return it  
    const bookingId = db.ref().push().key;  
     
    // Calculate payment details for earnings tracking  
    const paymentAmount = activity.pricePerGuest * requestedGuests;  
    const hostEarnings = paymentAmount * 0.8; // 80% for host  
    const platformFee = paymentAmount * 0.2; // 20% platform fee

    // FIXED CODE: Properly parse the activity date and time slot with Pakistan time zone consideration
    // First, log the received data for debugging
    logger.debug(`[bookTimeSlot] Date received: ${date}, Slot ID: ${slotId}`);

    // Parse time slot in format "6-00_am_-_10-00_am"
    const timeParts = slotId.split("_-_");
    if (timeParts.length !== 2) {
      logger.error(`[bookTimeSlot] Invalid time slot format: ${slotId}`);
      return res.status(400).json({ success: false, message: "Invalid time slot format" });
    }

    // Get end time part "10-00_am"
    const endTimePart = timeParts[1];
    const endTimeSplit = endTimePart.split("_"); // ["10-00", "am"]
    
    if (endTimeSplit.length !== 2) {
      logger.error(`[bookTimeSlot] Invalid end time format: ${endTimePart}`);
      return res.status(400).json({ success: false, message: "Invalid time format" });
    }
    
    // Extract hours and minutes from "10-00"
    const timeNumbers = endTimeSplit[0].split("-");
    let hours = parseInt(timeNumbers[0], 10);
    const minutes = parseInt(timeNumbers[1], 10);
    
    // Handle AM/PM
    const isPM = endTimeSplit[1].toLowerCase() === "pm";
    if (isPM && hours < 12) hours += 12; // Convert to 24-hour format
    if (!isPM && hours === 12) hours = 0; // 12 AM = 0 in 24-hour
    
    // Create date with Pakistan time zone adjustment (UTC+5)
    // First, parse the date (YYYY-MM-DD) into year, month, day components
    const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
    
    // Create the date in Pakistan time context
    // Note: month is 0-indexed in JavaScript Date
    const pstOffset = 5 * 60 * 60 * 1000; // Pakistan is UTC+5 (in milliseconds)
    const bookingEndTime = new Date(Date.UTC(year, month - 1, day, hours - 5, minutes, 0, 0));
    
    // Log the time in Pakistan format for verification
    logger.info(`[bookTimeSlot] Activity date: ${date}`);
    logger.info(`[bookTimeSlot] Activity end time (original): ${hours}:${minutes} ${isPM ? 'PM' : 'AM'}`);
    logger.info(`[bookTimeSlot] Activity end time in UTC: ${bookingEndTime.toISOString()}`);
    logger.info(`[bookTimeSlot] Activity end time in Pakistan: ${new Date(bookingEndTime.getTime() + pstOffset).toISOString()}`);
    
    // Calculate review eligible timestamp (24 hours after activity end)
    const reviewEligibleTimestamp = bookingEndTime.getTime() + (24 * 60 * 60 * 1000);
    
    // Log calculated timestamps for verification
    logger.info(`[bookTimeSlot] Review eligible time (UTC): ${new Date(reviewEligibleTimestamp).toISOString()}`);
    logger.info(`[bookTimeSlot] Review eligible time in Pakistan: ${new Date(reviewEligibleTimestamp + pstOffset).toISOString()}`);

    // 5) Finalize booking with a transaction    
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
        logger.warn(`[bookTimeSlot] Slot is full. Booking rejected.`);    
        return; // transaction fails    
      }    
      if (currentDayGuests + requestedGuests > activity.maxGuestsPerDay) {    
        logger.warn(`[bookTimeSlot] Max daily guests reached. Booking rejected.`);    
        return;    
      }

      dayData[slotId].totalGuestsBooked += requestedGuests;    
      dayData.totalGuestsForDay += requestedGuests;

      // Add booking record with payment and earnings information  
      dayData[slotId].bookingRecords[bookingId] = {    
        bookingId,    
        userId,    
        activityId,    
        requestedGuests,    
        createdAt: new Date().toISOString(),    
        paymentIntentId,  
        paymentAmount: paymentAmount,  
        hostEarnings: hostEarnings,  
        platformFee: platformFee,  
        paymentStatus: 'completed',  
        hostId: activity.hostId, // Include hostId for easier earnings queries
        reviewEligibleTimestamp: reviewEligibleTimestamp,
        hasFeedback: false
      };

      return dayData;    
    });

    if (!transactionResult.committed) {    
      logger.warn(`[bookTimeSlot] Transaction failed due to overbooking.`);    
      return res.status(400).json({ success: false, message: "Slot fully booked. Please choose another." });    
    }

    // 6) Create a payment record for earnings tracking    
    try {  
      // First check if a payment record with this paymentIntentId already exists  
      const existingPaymentQuery = await db.ref('payments')  
        .orderByChild('paymentIntentId')  
        .equalTo(paymentIntentId)  
        .once('value');  
         
      // Only create a new payment record if one doesn't already exist  
      if (!existingPaymentQuery.exists()) {  
        const paymentRef = db.ref('payments').push();    
        await paymentRef.set({    
          bookingId,    
          activityId,    
          paymentIntentId,    
          paymentAmount,    
          hostId: activity.hostId,    
          hostEarnings,    
          platformFee,    
          requestedGuests,    
          bookingDate: date,    
          timeSlot: slotId,    
          userId,    
          status: 'completed',    
          createdAt: admin.database.ServerValue.TIMESTAMP    
        });    
        logger.info(`[bookTimeSlot] Payment record created for earnings tracking: ${paymentRef.key}`);  
      } else {  
        logger.info(`[bookTimeSlot] Payment record already exists for paymentIntentId: ${paymentIntentId}, skipping creation`);  
      }  
    } catch (paymentError) {    
      // Log error but don't fail the booking    
      logger.error(`[bookTimeSlot] Error creating payment record: ${paymentError.message}`);    
    }

    // 8) Check and update listingStatus if needed    
    await checkAndUpdateListingStatus(activityId, activity);

    // 9) Send confirmation email    
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
          logger.error('[bookTimeSlot] Booking confirmation email sending failed:', emailResponse.error);    
        } else {    
          logger.info('[bookTimeSlot] Booking confirmation email sent successfully.');    
        }    
      }    
    } catch (emailErr) {    
      logger.error('[bookTimeSlot] Error retrieving user email or sending email:', emailErr);    
    }

    // 10) Notify host    
    try {    
      if (activity.hostId) {    
        const hostRecord = await admin.auth().getUser(activity.hostId);    
        if (hostRecord && hostRecord.email) {    
          const userSnapshot = await db.ref(`users/${userId}`).once('value');    
          const userData = userSnapshot.val();    
          const userName = (userData && userData.name) ? userData.name : "a customer";

          const slotLabel = getSlotDisplayLabel(activity, slotId) || "Timing not available";    
          const hostName = activity.hostName || "Host";

          const hostEmailResponse = await sendEmail({    
            to: hostRecord.email,    
            subject: 'New Booking Received',    
            text: `Dear ${hostName},

We're pleased to inform you that ${userName} has just booked your activity: "${activity.activityTitle}."    
Date of Booking: ${date}    
Time Slot: ${slotLabel}    
Number of Guests: ${requestedGuests}

Thank you for hosting on our platform!`,    
            html: `<p>Dear ${hostName},</p>    
<p>We're pleased to inform you that <strong>${userName}</strong> has just booked your activity: <strong>${activity.activityTitle}</strong>.</p>    
<ul>    
  <li><strong>Date of Booking:</strong> ${date}</li>    
  <li><strong>Time Slot:</strong> ${slotLabel}</li>    
  <li><strong>Number of Guests:</strong> ${requestedGuests}</li>    
</ul>    
<p>Thank you for hosting on our platform!</p>`    
          });

          if (!hostEmailResponse.success) {    
            logger.error('[bookTimeSlot] Host email sending failed:', hostEmailResponse.error);    
          } else {    
            logger.info('[bookTimeSlot] Notification email sent successfully to host.');    
          }    
        }    
      }    
    } catch (hostEmailErr) {    
      logger.error('[bookTimeSlot] Error retrieving host email or sending email:', hostEmailErr);    
    }

    logger.info('[bookTimeSlot] Booking confirmed!');  
    return res.status(200).json({    
      success: true,    
      message: "Booking successful!",  
      bookingId: bookingId // Return the bookingId to the client  
    });    
  } catch (error) {    
    logger.error('[bookTimeSlot] Error:', error);    
    return res.status(500).json({    
      success: false,    
      message: "Internal server error.",    
      error: error.message,    
    });    
  }    
};