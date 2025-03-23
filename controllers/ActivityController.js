// controllers/ActivityController.js

const { db } = require('../config/db');
const cloudinary = require('../config/cloudinaryConfig'); 

// Import Winston logger
const logger = require('../middleware/logger');

const CreateActivity = async (req, res) => {
  const {
    activityInfo,
    locationInfo,
    scheduleInfo,
    participantsInfo,
    priceInfo,
    imagesInfo,
    hostInfo,
  } = req.body;

  // Changed from console.log to logger.debug
  logger.debug('Received Data:', {
    activityInfo,
    locationInfo,
    scheduleInfo,
    participantsInfo,
    priceInfo,
    imagesInfo,
    hostInfo,
  });

  // Validate input fields
  if (!activityInfo || !locationInfo || !scheduleInfo || !participantsInfo || !priceInfo) {
    return res.status(400).send({ error: 'Required fields are missing.' });
  }
  if (!imagesInfo.activityImages || imagesInfo.activityImages.length < 3) {
    return res.status(400).send({ error: 'At least 3 activity images are required.' });
  }
  if (!imagesInfo.profileImage?.uri) {
    return res.status(400).send({ error: 'A profile image is required.' });
  }

  try {
    const uploadedActivityImages = [];
    let certificateUri = ''; // Initialize as empty string instead of using hostInfo.certificateUri

    // **Upload Activity Images**
    for (const image of imagesInfo.activityImages) {
      if (image.uri) {
        const result = await cloudinary.uploader.upload(image.uri, {
          folder: 'touristguide/activityImages',
        });
        uploadedActivityImages.push(result.secure_url);
      }
    }

    // **Upload Profile Image**
    let profileImageUri = null;
    if (imagesInfo.profileImage?.uri) {
      const profileResult = await cloudinary.uploader.upload(imagesInfo.profileImage.uri, {
        folder: 'touristguide/profileImages',
      });
      profileImageUri = profileResult.secure_url;
    }

    // **Upload Certificate if Provided**
    if (hostInfo.file?.uri) {
      const certificateResult = await cloudinary.uploader.upload(hostInfo.file.uri, {
        folder: 'touristguide/certificates',
        resource_type: 'raw',
      });
      certificateUri = certificateResult.secure_url;
    }
    // If no certificate uploaded, certificateUri remains empty string

    // **Save to Firebase**
    const newActivityRef = db.ref('activities').push();
    const newActivityId = newActivityRef.key;

    const newActivity = {
      activityId: newActivityId,
      ...activityInfo,
      ...locationInfo,
      ...scheduleInfo,
      ...participantsInfo,
      ...priceInfo,
      activityImages: uploadedActivityImages,
      profileImage: profileImageUri,
      certificateUri, // Will now always be either URL or empty string
      companyName: hostInfo.companyName || '',
      cnic: hostInfo.cnic,
      phoneNumber: hostInfo.phoneNumber,
      hostId: hostInfo.hostId,
      status: 'Pending',
      listingStatus: 'List',
      createdAt: new Date().toISOString(),
    };

    await newActivityRef.set(newActivity);

    // Changed from console.log to logger.info
    logger.info(`Activity Created Successfully: ${newActivityId}`);
    res.status(201).send({ message: 'Activity created successfully!', activityId: newActivityId });
  } catch (error) {
    // Changed from console.error to logger.error
    logger.error(`Error creating activity: ${error.message}`);
    res.status(500).send({ error: 'Failed to create activity.' });
  }
};

const uploadToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }

    const { fileType } = req.body;
    const folder = fileType === 'activityImage'
      ? 'touristguide/activityImages'
      : fileType === 'profileImage'
      ? 'touristguide/profileImages'
      : 'touristguide/certificates';

    // Changed from console.log to logger.debug
    logger.debug('Incoming File Data:', req.file);

    // Convert buffer to base64 for Cloudinary upload
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder,
      resource_type: fileType === 'certificate' ? 'raw' : 'image',
    });

    // Changed from console.log to logger.info
    logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
    res.status(201).json({ url: result.secure_url });
  } catch (error) {
    // Changed from console.error to logger.error
    logger.error(`Error uploading to Cloudinary: ${error.message}`);
    res.status(500).json({ error: 'Server error during file upload.' });
  }
};

// Added from ActivityRouter inline handlers
const getAllActivities = async (req, res) => {
  try {
    logger.info('[ActivityController] Fetching all activities');
    
    // Get activities from database
    const activitiesSnapshot = await db.ref('activities').once('value');
    const activities = activitiesSnapshot.val() || {};
    
    logger.info(`[ActivityController] Found ${Object.keys(activities).length} activities`);
    
    return res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    logger.error('[ActivityController] Error fetching all activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message
    });
  }
};

// Added from ActivityRouter inline handlers
const getActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    
    if (!activityId) {
      return res.status(400).json({
        success: false,
        message: 'Activity ID is required'
      });
    }
    
    logger.info(`[ActivityController] Fetching details for activity: ${activityId}`);
    
    // Get activity from database
    const activitySnapshot = await db.ref(`activities/${activityId}`).once('value');
    
    if (!activitySnapshot.exists()) {
      logger.warn(`[ActivityController] Activity not found: ${activityId}`);
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }
    
    const activityData = activitySnapshot.val();
    logger.info(`[ActivityController] Activity found: ${activityId}, title: ${activityData.activityTitle || 'No title'}`);
    
    return res.status(200).json({
      success: true,
      data: activityData
    });
  } catch (error) {
    logger.error(`[ActivityController] Error fetching activity ${req.params.activityId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching activity',
      error: error.message
    });
  }
};

// Added from ActivityRouter inline handlers
const getActivityDetails = async (req, res) => {
  try {
    const { activityId } = req.params;
    
    if (!activityId) {
      return res.status(400).json({
        success: false,
        message: 'Activity ID is required'
      });
    }
    
    logger.info(`[ActivityController] Fetching detailed info for activity: ${activityId}`);
    
    // Get activity from database
    const activitySnapshot = await db.ref(`activities/${activityId}`).once('value');
    
    if (!activitySnapshot.exists()) {
      logger.warn(`[ActivityController] Activity details not found: ${activityId}`);
      return res.status(404).json({
        success: false,
        message: 'Activity details not found'
      });
    }
    
    const activityData = activitySnapshot.val();
    logger.info(`[ActivityController] Activity details found: ${activityId}, title: ${activityData.activityTitle || 'No title'}`);
    
    return res.status(200).json({
      success: true,
      data: activityData
    });
  } catch (error) {
    logger.error(`[ActivityController] Error fetching activity details ${req.params.activityId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching activity details',
      error: error.message
    });
  }
};

module.exports = {
  uploadToCloudinary,
  CreateActivity,
  getAllActivities,
  getActivity,
  getActivityDetails
};