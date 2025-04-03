// utils/SendFeedbackReminders.js
const { db, admin } = require('../config/db');
const sendEmail = require('../config/emailService');
const logger = require('../middleware/logger');

/**
 * Sends feedback reminder emails to users for activities they booked
 * 24 hours after the activity end time
 * 
 * @returns {Promise<number>} Number of reminder emails sent
 */
async function sendFeedbackReminders() {
  const now = Date.now();
  let emailsSent = 0;
  const bookingsToCheck = [];
  
  try {
    logger.info('[SendFeedbackReminders] Checking for bookings eligible for feedback reminders...');
    
    // Get all activity bookings
    const bookingsSnapshot = await db.ref('bookings').once('value');
    
    // Process each activity's bookings
    bookingsSnapshot.forEach(activitySnapshot => {
      const activityId = activitySnapshot.key;
      
      // Skip non-object entries
      if (typeof activitySnapshot.val() !== 'object') return;
      
      // Process each date
      activitySnapshot.forEach(dateSnapshot => {
        const date = dateSnapshot.key;
        
        // Skip totalGuestsForDay entry
        if (date === 'totalGuestsForDay') return;
        
        // Process each time slot
        dateSnapshot.forEach(slotSnapshot => {
          const timeSlot = slotSnapshot.key;
          
          // Skip totalGuestsBooked entry
          if (timeSlot === 'totalGuestsBooked') return;
          
          // Check if this slot has booking records
          if (slotSnapshot.hasChild('bookingRecords')) {
            // Get each booking record
            const bookingRecords = slotSnapshot.child('bookingRecords').val();
            
            Object.entries(bookingRecords).forEach(([bookingId, bookingData]) => {
              // Check if:
              // 1. The booking has a reviewEligibleTimestamp
              // 2. The time has passed (now > reviewEligibleTimestamp)
              // 3. The user hasn't already submitted feedback (hasFeedback is false)
              // 4. A reminder hasn't been sent yet (feedbackReminderSent is falsy)
              if (
                bookingData.reviewEligibleTimestamp && 
                now >= bookingData.reviewEligibleTimestamp && 
                bookingData.hasFeedback === false && 
                !bookingData.feedbackReminderSent
              ) {
                bookingsToCheck.push({
                  activityId,
                  date,
                  timeSlot,
                  bookingId,
                  userId: bookingData.userId,
                  bookingPath: `bookings/${activityId}/${date}/${timeSlot}/bookingRecords/${bookingId}`
                });
              }
            });
          }
        });
      });
    });
    
    logger.info(`[SendFeedbackReminders] Found ${bookingsToCheck.length} bookings eligible for feedback reminders`);
    
    // Process eligible bookings and send emails
    for (const bookingInfo of bookingsToCheck) {
      try {
        // Get activity details
        const activitySnapshot = await db.ref(`activities/${bookingInfo.activityId}`).once('value');
        if (!activitySnapshot.exists()) {
          logger.warn(`[SendFeedbackReminders] Activity ${bookingInfo.activityId} not found, skipping reminder`);
          continue;
        }
        
        const activity = activitySnapshot.val();
        
        // Get user details
        const userSnapshot = await db.ref(`users/${bookingInfo.userId}`).once('value');
        const userRecord = await admin.auth().getUser(bookingInfo.userId);
        
        if (!userRecord || !userRecord.email) {
          logger.warn(`[SendFeedbackReminders] User email not found for ${bookingInfo.userId}, skipping reminder`);
          continue;
        }
        
        const userData = userSnapshot.val() || {};
        const userName = userData.name || "Valued Customer";
        
        // Send feedback request email
        const emailResponse = await sendEmail({
          to: userRecord.email,
          subject: `Your Feedback Matters - ${activity.activityTitle}`,
          text: `Dear ${userName},

Thank you for booking "${activity.activityTitle}" with us. We hope you had a great experience!

We'd love to hear your feedback about the activity. Your opinion helps us improve our services and assists other travelers in making informed decisions.

To share your feedback, please log in to the TouristGuide app and navigate to your Trips section, where you'll find the option to review this activity.

Thank you for your time!

Best regards,
The TouristGuide Team`,
          html: `<p>Dear ${userName},</p>
<p>Thank you for booking <strong>"${activity.activityTitle}"</strong> with us. We hope you had a great experience!</p>
<p>We'd love to hear your feedback about the activity. Your opinion helps us improve our services and assists other travelers in making informed decisions.</p>
<p>To share your feedback, please log in to the TouristGuide app and navigate to your Trips section, where you'll find the option to review this activity.</p>
<p>Thank you for your time!</p>
<p>Best regards,<br/>The TouristGuide Team</p>`
        });
        
        if (emailResponse.success) {
          // Mark the booking as having received a feedback reminder
          await db.ref(bookingInfo.bookingPath).update({
            feedbackReminderSent: true,
            feedbackReminderSentAt: admin.database.ServerValue.TIMESTAMP
          });
          
          emailsSent++;
          logger.info(`[SendFeedbackReminders] Feedback reminder sent for booking ${bookingInfo.bookingId} (${activity.activityTitle})`);
        } else {
          logger.error(`[SendFeedbackReminders] Failed to send feedback reminder for booking ${bookingInfo.bookingId}: ${emailResponse.error}`);
        }
      } catch (bookingError) {
        logger.error(`[SendFeedbackReminders] Error processing booking ${bookingInfo.bookingId}: ${bookingError.message}`);
      }
    }
    
    return emailsSent;
  } catch (error) {
    logger.error(`[SendFeedbackReminders] Error sending feedback reminders: ${error.message}`);
    throw error;
  }
}

module.exports = { sendFeedbackReminders };