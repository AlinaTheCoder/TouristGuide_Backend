// controllers/UserProfileController.js
const { db, admin, auth } = require('../config/db');
const logger = require('../middleware/logger');
// Add to controllers/UserProfileController.js
const cloudinary = require('../config/cloudinaryConfig');
const streamifier = require('streamifier');


const UpdateProfileImage = async (req, res) => {
  try {
    const { uid } = req.body;
   
    // Validate request
    if (!uid || !req.file) {
      return res.status(400).send({ error: 'User ID and image are required' });
    }


    // Create a stream from the buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'touristguide/profileimages',
        transformation: [
          { width: 300, height: 300, crop: 'fill' },
          { quality: 'auto' }
        ]
      },
      async (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload error: ${error.message}`);
          return res.status(500).send({ error: 'Failed to upload image to Cloudinary' });
        }


        const imageUrl = result.secure_url;


        try {
          // 1. Update the user data in the users node to include profileImage
          await db.ref(`users/${uid}`).update({
            profileImage: imageUrl,
            profileImageUpdatedAt: new Date().toISOString()
          });


          // 2. Update all activities where hostId = uid (if any exist)
          const activitiesRef = db.ref('activities');
          const activitiesSnapshot = await activitiesRef
            .orderByChild('hostId')
            .equalTo(uid)
            .once('value');


          if (activitiesSnapshot.exists()) {
            const activitiesData = activitiesSnapshot.val();
            const updates = {};
           
            Object.keys(activitiesData).forEach((activityKey) => {
              updates[`${activityKey}/profileImage`] = imageUrl;
            });
           
            await activitiesRef.update(updates);
          }


          res.status(200).send({
            message: 'Profile image updated successfully',
            imageUrl: imageUrl
          });
        } catch (dbError) {
          logger.error(`Database update error: ${dbError.message}`);
          res.status(500).send({ error: 'Failed to update profile image in database' });
        }
      }
    );


    // Stream the buffer to Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    logger.error(`Profile image update error: ${error.message}`);
    res.status(500).send({ error: 'An error occurred while updating profile image' });
  }
};


const GetUserByID = async (req, res) => {
  const { uid } = req.params; // uid from the URL
  try {
    // Fetch data from Firebase Authentication
    const userRecord = await admin.auth().getUser(uid);


    // Fetch additional data from Firebase Realtime Database
    const snapshot = await db.ref(`users/${uid}`).once('value');
    const additionalData = snapshot.val() || {};


    // Check if user has a profile image directly in the users node
    let profileImage = additionalData.profileImage || null;
   
    // If no direct profile image found, check hosted activities
    if (!profileImage) {
      const activitiesRef = db.ref('activities');
      const activitiesSnapshot = await activitiesRef
        .orderByChild('hostId')
        .equalTo(uid)
        .once('value');


      if (activitiesSnapshot.exists()) {
        const activitiesObj = activitiesSnapshot.val();
        const activitiesArray = Object.values(activitiesObj);


        // Sort by createdAt (descending)
        activitiesArray.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );


        const lastActivity = activitiesArray[0];
        if (lastActivity && lastActivity.profileImage) {
          profileImage = lastActivity.profileImage;
        }
      }
    }


    // Merge and respond with the data
    return res.status(200).send({
      uid: userRecord.uid,
      email: userRecord.email,
      name: additionalData.name || 'N/A',
      loginWithGoogle: additionalData.loginWithGoogle,
      profileImage: profileImage,
    });
  } catch (error) {
    logger.error(`Error fetching user data: ${error.message}`);
    return res
      .status(500)
      .send({ error: 'An error occurred while fetching user data.' });
  }
};


const GetHostPersonalInfo = async (req, res) => {
  const { uid } = req.params;


  try {
    // 1) Get user from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);


    // 2) Get additional user data from Realtime DB
    const userSnapshot = await db.ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val() || {};


    // 3) Fetch the host's LAST LISTED activity
    const activitiesRef = db.ref('activities');
    const activitiesSnapshot = await activitiesRef
      .orderByChild('hostId')
      .equalTo(uid)
      .once('value');


    let phoneNumber = null;
    let cnic = null;


    if (activitiesSnapshot.exists()) {
      const activitiesObj = activitiesSnapshot.val();
      const activitiesArray = Object.values(activitiesObj);


      // Sort by createdAt (descending), so index 0 is the most recent
      activitiesArray.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );


      const lastActivity = activitiesArray[0];


      if (lastActivity) {
        phoneNumber = lastActivity.phoneNumber || null;
        cnic = lastActivity.cnic || null;
      }
    }
    // 4) Return the combined data
    return res.status(200).send({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userData.name || 'N/A',
      loginWithGoogle: userData.loginWithGoogle,
      phoneNumber,
      cnic,
    });
  } catch (error) {
    logger.error(`Error fetching host personal info: ${error.message}`);
    return res
      .status(500)
      .send({ error: 'An error occurred while fetching host personal info.' });
  }
};


const EditName = async (req, res) => {
  const { uid } = req.params;
  const { name } = req.body;


  // Validate input
  if (!uid || !name) {
    return res.status(400).send({ error: 'UID and name are required.' });
  }


  try {
    // 1) Update the user's name in "users/<uid>"
    const userRef = db.ref(`users/${uid}`);
    const snapshot = await userRef.once('value');


    if (!snapshot.exists()) {
      return res.status(404).send({ error: 'User not found.' });
    }
    await userRef.update({ name });


    // 2) Update all activities in "activities" where hostId == uid, if they exist
    const activitiesRef = db.ref('activities');
    const activitiesSnapshot = await activitiesRef
      .orderByChild('hostId')
      .equalTo(uid)
      .once('value');


    if (activitiesSnapshot.exists()) {
      const activitiesData = activitiesSnapshot.val();


      // Build a multi-path update for all matching activities
      const updates = {};
      Object.keys(activitiesData).forEach((activityKey) => {
        updates[`${activityKey}/hostName`] = name;
      });


      // Apply all updates
      await activitiesRef.update(updates);
    }


    return res.status(200).send({ message: 'Name updated successfully!', uid, name });
  } catch (error) {
    logger.error(`Error updating name: ${error.message}`);
    return res
      .status(500)
      .send({ error: 'An error occurred while updating the name.' });
  }
};


const ChangePassword = async (req, res) => {
  const { uid, newPassword } = req.body;


  // Validate input
  if (!uid || !newPassword) {
    return res.status(400).send({ error: 'UID and new password are required.' });
  }


  try {
    await admin.auth().updateUser(uid, { password: newPassword });


    return res.status(200).send({
      message: 'Password changed successfully!',
    });
  } catch (error) {
    logger.error(`Error changing password: ${error.message}`);


    if (error.code === 'auth/user-not-found') {
      return res.status(404).send({ error: 'User not found.' });
    } else {
      return res
        .status(500)
        .send({ error: 'Failed to change password. Please try again.' });
    }
  }
};


module.exports = {
  GetUserByID,
  GetHostPersonalInfo,
  EditName,
  ChangePassword,
  UpdateProfileImage
};




