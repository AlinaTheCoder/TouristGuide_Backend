// controllers/EarningsController.js
const admin = require('firebase-admin');
const database = admin.database();

// Helper function to calculate the host's share (80% based on PriceInformationScreen)
const calculateHostShare = (amount) => parseFloat(amount) * 0.8;

// Parse date string to Date object
const parseDate = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString);
  } catch (e) {
    console.error('Invalid date format:', dateString);
    return null;
  }
};

// Helper to format currency
const formatCurrency = (amount) => {
  if (isNaN(amount)) return '0 PKR';
  return `${parseFloat(amount).toFixed(2)} PKR`;
};

// Controller functions for earnings
const EarningsController = {
  // Get total earnings for a host
  getHostEarnings: async (req, res) => {
    try {
      const { hostId } = req.params;

      if (!hostId) {
        return res.status(400).json({ error: 'Host ID is required' });
      }

      // Get all activities for this host
      const activitiesSnapshot = await database.ref('activities')
        .orderByChild('hostId')
        .equalTo(hostId)
        .once('value');

      const activities = activitiesSnapshot.val() || {};
      const activityIds = Object.keys(activities);

      if (activityIds.length === 0) {
        return res.status(200).json({
          success: true,
          hostName: 'Host',
          totalEarnings: 0,
          weeklyEarnings: 0,
          monthlyEarnings: {},
          yearlyEarnings: 0,
          recentBookings: []
        });
      }

      // Get host name
      const hostSnapshot = await database.ref(`users/${hostId}`).once('value');
      const hostData = hostSnapshot.val() || {};
      const hostName = hostData.name || hostData.displayName || 'Host';

      let totalEarnings = 0;
      let bookingDetails = [];

      // Get bookings for each activity
      for (const activityId of activityIds) {
        const activityBookingsSnapshot = await database.ref(`bookings/${activityId}`).once('value');
        const activityBookings = activityBookingsSnapshot.val() || {};

        // Process each booking date
        for (const bookingDate in activityBookings) {
          const dateBookings = activityBookings[bookingDate];

          // Process each time slot
          for (const timeSlot in dateBookings) {
            const slotData = dateBookings[timeSlot];
            if (!slotData.bookingRecords) continue;

            // Process booking records
            const bookingRecords = slotData.bookingRecords || {};

            for (const bookingId in bookingRecords) {
              const booking = bookingRecords[bookingId];

              // If there's a payment amount recorded, use it
              let paymentAmount = booking.paymentAmount;

              // If no payment amount is recorded, calculate it from the activity price
              if (!paymentAmount && activities[activityId]) {
                const pricePerGuest = activities[activityId].pricePerGuest || 0;
                const requestedGuests = booking.requestedGuests || 1;
                paymentAmount = pricePerGuest * requestedGuests;
              }

              // Calculate host's earnings
              const hostEarnings = booking.hostEarnings || calculateHostShare(paymentAmount || 0);

              // Add to total earnings
              totalEarnings += hostEarnings;

              // Find user name if available
              let userName = booking.userName || 'Guest';
              if (booking.userId) {
                try {
                  const userSnapshot = await database.ref(`users/${booking.userId}`).once('value');
                  const userData = userSnapshot.val();
                  if (userData && userData.name) {
                    userName = userData.name;
                  } else if (userData && userData.displayName) {
                    userName = userData.displayName;
                  }
                } catch (error) {
                  console.error('Error fetching user data:', error);
                }
              }

              // Add to booking details for UI display
              bookingDetails.push({
                bookingId,
                activityId,
                // Change from 'title' to 'activityTitle' to match your database structure
                activityTitle: activities[activityId]?.activityTitle || 'Unknown Activity',
                bookingDate,
                timeSlot,
                paymentAmount: paymentAmount || 0,
                hostEarnings,
                requestedGuests: booking.requestedGuests || 1,
                userName,
                createdAt: booking.createdAt,
                paymentStatus: booking.paymentStatus || 'completed'
              });
            }
          }
        }
      }

      // Organize data by time periods
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Filter bookings for current week, month, year, and all-time
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)

      // Initialize monthly earnings for the past year
      const monthlyEarnings = {};
      for (let i = 0; i < 12; i++) {
        const month = (currentMonth - i + 12) % 12;
        const year = currentYear - Math.floor((i - currentMonth) / 12);
        const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'short' });
        monthlyEarnings[monthName] = 0;
      }

      // Calculate weekly earnings
      const weeklyEarnings = bookingDetails.reduce((sum, booking) => {
        const bookingDate = parseDate(booking.createdAt);
        if (bookingDate && bookingDate >= weekStart) {
          return sum + booking.hostEarnings;
        }
        return sum;
      }, 0);

      // Calculate monthly earnings for the past year
      bookingDetails.forEach(booking => {
        const bookingDate = parseDate(booking.createdAt || booking.bookingDate);
        if (bookingDate) {
          const month = bookingDate.getMonth();
          const year = bookingDate.getFullYear();

          if (year === currentYear || (year === currentYear - 1 && month > currentMonth)) {
            const monthName = bookingDate.toLocaleString('default', { month: 'short' });
            monthlyEarnings[monthName] = (monthlyEarnings[monthName] || 0) + booking.hostEarnings;
          }
        }
      });

      // Calculate yearly total
      const yearlyEarnings = bookingDetails.reduce((sum, booking) => {
        const bookingDate = parseDate(booking.createdAt || booking.bookingDate);
        if (bookingDate && bookingDate.getFullYear() === currentYear) {
          return sum + booking.hostEarnings;
        }
        return sum;
      }, 0);

      // Sort bookings by date (newest first)
      const sortedBookings = bookingDetails.sort((a, b) => {
        const dateA = parseDate(a.createdAt || a.bookingDate) || new Date(0);
        const dateB = parseDate(b.createdAt || b.bookingDate) || new Date(0);
        return dateB - dateA;
      });

      // Format earnings for display
      const formattedEarnings = {
        totalEarnings: formatCurrency(totalEarnings),
        weeklyEarnings: formatCurrency(weeklyEarnings),
        yearlyEarnings: formatCurrency(yearlyEarnings)
      };

      // Format monthly earnings
      const formattedMonthlyEarnings = {};
      Object.keys(monthlyEarnings).forEach(month => {
        formattedMonthlyEarnings[month] = formatCurrency(monthlyEarnings[month]);
      });

      // Format booking data
      const formattedBookings = sortedBookings.map(booking => ({
        ...booking,
        hostEarnings: formatCurrency(booking.hostEarnings),
        paymentAmount: formatCurrency(booking.paymentAmount)
      }));

      // Response with earnings data
      return res.status(200).json({
        success: true,
        hostName,
        totalEarnings: formattedEarnings.totalEarnings,
        weeklyEarnings: formattedEarnings.weeklyEarnings,
        monthlyEarnings: formattedMonthlyEarnings,
        yearlyEarnings: formattedEarnings.yearlyEarnings,
        recentBookings: formattedBookings.slice(0, 10), // Get 10 most recent bookings
        rawData: {
          totalEarnings,
          weeklyEarnings,
          monthlyEarnings,
          yearlyEarnings
        }
      });

    } catch (error) {
      console.error('[EarningsController] Error getting host earnings:', error);
      return res.status(500).json({
        error: 'Failed to fetch earnings data',
        message: error.message
      });
    }
  },

  // Record a payment (this should be triggered after a successful Stripe payment)
  recordPayment: async (req, res) => {
    try {
      const {
        bookingId,
        activityId,
        paymentIntentId,
        paymentAmount,
        requestedGuests,
        bookingDate,
        timeSlot,
        userId
      } = req.body;

      if (!bookingId || !activityId || !paymentIntentId || !paymentAmount) {
        return res.status(400).json({ error: 'Missing required payment information' });
      }

      // Get the activity to find the host ID
      const activitySnapshot = await database.ref(`activities/${activityId}`).once('value');
      const activity = activitySnapshot.val();

      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const hostId = activity.hostId;
      const amount = parseFloat(paymentAmount);

      // Calculate host earnings and platform fee
      const hostEarnings = calculateHostShare(amount);
      const platformFee = amount - hostEarnings;

      // Update booking record with payment information
      const bookingPath = `bookings/${activityId}/${bookingDate}/${timeSlot}/bookingRecords/${bookingId}`;
      await database.ref(bookingPath).update({
        paymentAmount: amount,
        hostEarnings,
        platformFee,
        paymentStatus: 'completed',
        paymentIntentId
      });

      // Create a payment record for tracking
      // Check if a payment record with this paymentIntentId already exists
      const existingPaymentSnapshot = await database.ref('payments')
        .orderByChild('paymentIntentId')
        .equalTo(paymentIntentId)
        .once('value');

      // Only create a new payment record if one doesn't already exist
      if (!existingPaymentSnapshot.exists()) {
        // Create a payment record for tracking  
        const paymentRef = database.ref('payments').push();
        await paymentRef.set({
          bookingId,
          activityId,
          paymentIntentId,
          paymentAmount: amount,
          hostId,
          hostEarnings,
          platformFee,
          requestedGuests: requestedGuests || 1,
          bookingDate,
          timeSlot,
          userId,
          status: 'completed',
          createdAt: admin.database.ServerValue.TIMESTAMP
        });
        console.log(`[EarningsController] Payment record created: ${paymentRef.key}`);
      } else {
        console.log(`[EarningsController] Payment record already exists for paymentIntentId: ${paymentIntentId}, skipping creation`);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment recorded successfully',
        paymentId: paymentRef.key,
        hostEarnings,
        platformFee
      });

    } catch (error) {
      console.error('[EarningsController] Error recording payment:', error);
      return res.status(500).json({
        error: 'Failed to record payment',
        message: error.message
      });
    }
  }
};

module.exports = EarningsController;