// routers/UserProfileRouter.js
const express = require('express');
const multer = require('multer');
const UserProfileRouter = express.Router();
const UserProfileController = require('../controllers/UserProfileController');
const { db, admin } = require('../config/db'); // Add this import
const logger = require('../middleware/logger'); // Add this import


// Set up multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });


UserProfileRouter.get('/users/GetUserById/:uid', UserProfileController.GetUserByID);
UserProfileRouter.get('/hostPersonalInfo/:uid', UserProfileController.GetHostPersonalInfo);
UserProfileRouter.put('/users/EditName/:uid', UserProfileController.EditName);
UserProfileRouter.put('/users/ChangePassword', UserProfileController.ChangePassword);
UserProfileRouter.post('/users/updateProfileImage', upload.single('image'), UserProfileController.UpdateProfileImage);


// FCM Token Update Endpoint
UserProfileRouter.post('/user/update-fcm-token', async (req, res) => {
    try {
      const { userId, fcmToken } = req.body;
     
      if (!userId || !fcmToken) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
     
      // Update the FCM token in the user's record
      await db.ref(`users/${userId}`).update({
        fcmToken,
        fcmTokenUpdatedAt: admin.database.ServerValue.TIMESTAMP
      });
     
      logger.info(`[updateFCMToken] FCM token updated for user ${userId}`);
     
      return res.status(200).json({
        success: true,
        message: 'FCM token updated successfully'
      });
    } catch (error) {
      logger.error(`[updateFCMToken] Error updating FCM token:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error updating FCM token',
        error: error.message
      });
    }
});


module.exports = UserProfileRouter;
