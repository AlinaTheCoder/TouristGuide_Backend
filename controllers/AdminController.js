// controllers/AdminController.js
const { db, admin } = require('../config/db');
const sendEmail = require('../config/emailService');
const { transformPendingActivity, transformActivityImage } = require('../utils/Admin');
const logger = require('../middleware/logger');

exports.getPendingRequests = async (req, res) => {
  try {
    const activitiesRef = db.ref('activities');

    // Query pending activities with status === 'Pending'
    const snapshot = await activitiesRef
      .orderByChild('status')
      .equalTo('Pending')
      .once('value');

    // Check if pending activities exist
    const hasPending = snapshot.exists();
    const pendingActivities = [];

    if (hasPending) {
      snapshot.forEach((childSnapshot) => {
        const activityData = childSnapshot.val();

        // Changed from console.log to logger.debug
        logger.debug('[DEBUG] Pending Activity Details:', {
          id: childSnapshot.key,
          activityTitle: activityData.activityTitle,
          createdAt: activityData.createdAt,
          images: activityData.activityImages,
          fullData: activityData,
        });

        pendingActivities.push(transformPendingActivity(childSnapshot));
      });
    }

    // Changed from console.log to logger.debug
    logger.debug('[DEBUG] Pending Requests Summary:', {
      hasPendingActivities: hasPending,
      totalPendingActivities: pendingActivities.length,
    });

    return res.status(200).json({
      success: true,
      hasPending,
      activitiesCount: pendingActivities.length,
      data: pendingActivities,
    });
  } catch (error) {
    // Changed from console.error to logger.error
    logger.error('[AdminController] Error fetching pending requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

exports.fetchActivityDetailsById = async (req, res) => {
  try {
    logger.debug('------- FETCH ACTIVITY DETAILS START -------');
    logger.debug(`Request Method: ${req.method}`);
    logger.debug(`Request URL: ${req.originalUrl}`);
    logger.debug('Request Params:', req.params);
    logger.debug('Query Params:', req.query);

    const { activityId } = req.params;
    const { includeVerificationDetails, includeLikedStatus } = req.query;

    logger.debug(`Activity ID: ${activityId}`);
    logger.debug(`Include Verification Details: ${includeVerificationDetails}`);
    logger.debug(`Include Liked Status: ${includeLikedStatus}`);

    const activityRef = db.ref(`activities/${activityId}`);
    logger.debug(`Firebase Reference Created: activities/${activityId}`);

    const snapshot = await activityRef.once('value');
    logger.debug(`Snapshot Exists: ${snapshot.exists()}`);
    if (!snapshot.exists()) {
      logger.error(`Activity not found for ID: ${activityId}`);
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    const activityData = snapshot.val();
    logger.debug('Raw Activity Data:', JSON.stringify(activityData, null, 2));

    const responseData = {
      ...activityData,
      id: activityId,
    };

    if (includeVerificationDetails === 'true') {
      responseData.acceptedAt = activityData.acceptedAt || null;
      responseData.rejectedAt = activityData.rejectedAt || null;
      logger.debug('Verification Details Included:');
      logger.debug(`Accepted At: ${responseData.acceptedAt}`);
      logger.debug(`Rejected At: ${responseData.rejectedAt}`);
    }

    if (includeLikedStatus === 'true') {
      responseData.likedStatus = activityData.likedStatus || false;
      logger.debug(`Liked Status Included: ${responseData.likedStatus}`);
    }

    logger.debug('Final Response Data:', JSON.stringify(responseData, null, 2));
    logger.debug('------- FETCH ACTIVITY DETAILS SUCCESS -------');

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Error fetching activity details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  } finally {
    logger.debug('------- FETCH ACTIVITY DETAILS END -------');
  }
};

exports.acceptActivity = async (req, res) => {
  try {
    logger.debug('------- ACCEPT ACTIVITY START -------');

    const { activityId } = req.params;
    const acceptedAt = new Date().toISOString();

    // Reference to the activity in Firebase
    const activityRef = db.ref(`activities/${activityId}`);

    // Check if the activity exists
    const snapshot = await activityRef.once('value');
    if (!snapshot.exists()) {
      logger.debug(`Activity not found: ${activityId}`);
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    const activityData = snapshot.val();

    // Fetch the host's email from Firebase Auth
    const hostUid = activityData.hostId; // Assuming hostId is stored in the activity
    const userRecord = await admin.auth().getUser(hostUid);

    if (!userRecord.email) {
      logger.error('[AcceptActivity] No email associated with the host:', hostUid);
      return res.status(400).json({
        success: false,
        message: 'Host does not have an email associated.',
      });
    }

    const hostEmail = userRecord.email;

    // Update the status and acceptedAt fields in the database
    await activityRef.update({
      status: 'Accepted',
      acceptedAt,
    });

    // Send an email notification to the host
    const emailResponse = await sendEmail({
      to: hostEmail,
      subject: 'Your Activity has been Accepted!',
      text: `Congratulations! Your activity "${activityData.activityTitle}" has been accepted.`,
      html: `<p>Dear Host,</p>
             <p>We are pleased to inform you that your activity, "<strong>${activityData.activityTitle}</strong>", has been successfully accepted.</p>
             <p>Thank you for being a valued host!</p>
             <p>Best regards,<br/>TouristGuide Team</p>`,
    });

    if (!emailResponse.success) {
      logger.error('[AcceptActivity] Email sending failed:', emailResponse.error);
    }

    // Changed from console.log to logger.info for success
    logger.info(`Activity successfully accepted: ${activityId}`);
    return res.status(200).json({
      success: true,
      message: 'Activity successfully accepted',
      acceptedAt,
      emailSent: emailResponse.success,
    });
  } catch (error) {
    logger.error('[AcceptActivity] Error accepting activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  } finally {
    logger.debug('------- ACCEPT ACTIVITY END -------');
  }
};

exports.rejectActivity = async (req, res) => {
  try {
    logger.debug('------- REJECT ACTIVITY START -------');

    const { activityId } = req.params;
    const rejectedAt = new Date().toISOString();

    // Reference to the activity in Firebase
    const activityRef = db.ref(`activities/${activityId}`);
    const snapshot = await activityRef.once('value');

    if (!snapshot.exists()) {
      logger.debug(`Activity not found: ${activityId}`);
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    const activityData = snapshot.val();

    // Fetch the host's email from Firebase Auth
    const hostUid = activityData.hostId; // Assuming hostId is stored in the activity
    const userRecord = await admin.auth().getUser(hostUid);

    if (!userRecord.email) {
      logger.error('[RejectActivity] No email associated with the host:', hostUid);
      return res.status(400).json({
        success: false,
        message: 'Host does not have an email associated.',
      });
    }

    const hostEmail = userRecord.email;

    // Update the status to "Rejected" and add rejectedAt
    await activityRef.update({
      status: 'Rejected',
      rejectedAt,
    });

    // Send an email notification to the host
    const emailResponse = await sendEmail({
      to: hostEmail,
      subject: 'Your Activity has been Rejected',
      text: `We regret to inform you that your activity "${activityData.activityTitle}" has been rejected.`,
      html: `<p>Dear Host,</p>
             <p>We regret to inform you that your activity, "<strong>${activityData.activityTitle}</strong>", has been rejected.</p>
             <p>Thank you for understanding.</p>
             <p>Best regards,<br/>TouristGuide Team</p>`,
    });

    if (!emailResponse.success) {
      logger.error('[RejectActivity] Email sending failed:', emailResponse.error);
    }

    // Changed from console.log to logger.info for success
    logger.info(`Activity successfully rejected: ${activityId}`);
    return res.status(200).json({
      success: true,
      message: 'Activity successfully rejected',
      rejectedAt,
      emailSent: emailResponse.success,
    });
  } catch (error) {
    logger.error('[RejectActivity] Error rejecting activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  } finally {
    logger.debug('------- REJECT ACTIVITY END -------');
  }
};

exports.fetchAllAcceptedActivities = async (req, res) => {
  try {
    logger.debug('[AdminController] fetchAllAcceptedActivities called');

    // Reference to activities in Realtime Database
    const activitiesRef = db.ref('activities');

    // Query activities with status === 'Accepted'
    const snapshot = await activitiesRef
      .orderByChild('status')
      .equalTo('Accepted')
      .once('value');

    // If no accepted activities are found, return an empty array
    if (!snapshot.exists()) {
      logger.debug('[DEBUG] No accepted activities found');
      return res.status(200).json({
        success: true,
        data: [], // No accepted activities
      });
    }

    // Process the snapshot and include only required fields
    const acceptedActivities = [];
    snapshot.forEach((childSnapshot) => {
      const activityDetails = transformActivityImage(childSnapshot, 'No Image');
      logger.debug('[DEBUG] Accepted Activity Details:', JSON.stringify(activityDetails, null, 2));
      logger.debug(activityDetails.activityTitle);
      acceptedActivities.push(activityDetails);
    });

    logger.debug('[DEBUG] Accepted Activities Count:', acceptedActivities.length);

    return res.status(200).json({
      success: true,
      data: acceptedActivities,
    });
  } catch (error) {
    logger.error('[AdminController] Error fetching accepted activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

exports.fetchAllRejectedActivities = async (req, res) => {
  try {
    logger.debug('[AdminController] fetchAllRejectedActivities called');

    // Reference to activities in Realtime Database
    const activitiesRef = db.ref('activities');

    // Query activities with status === 'Rejected'
    const snapshot = await activitiesRef
      .orderByChild('status')
      .equalTo('Rejected')
      .once('value');

    // If no rejected activities are found, return an empty array
    if (!snapshot.exists()) {
      logger.debug('[DEBUG] No rejected activities found');
      return res.status(200).json({
        success: true,
        data: [], // No rejected activities
      });
    }

    // Process the snapshot and include only required fields
    const rejectedActivities = [];
    snapshot.forEach((childSnapshot) => {
      const activityDetails = transformActivityImage(childSnapshot, 'No Image');
      logger.debug('[DEBUG] Rejected Activity Details:', JSON.stringify(activityDetails, null, 2));
      rejectedActivities.push(activityDetails);
    });

    logger.debug('[DEBUG] Rejected Activities Count:', rejectedActivities.length);

    return res.status(200).json({
      success: true,
      data: rejectedActivities,
    });
  } catch (error) {
    logger.error('[AdminController] Error fetching rejected activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
