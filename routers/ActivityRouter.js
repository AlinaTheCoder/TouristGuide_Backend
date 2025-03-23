// routers/ActivityRouter.js

const multer = require('multer');
const express = require('express');
const ActivityController = require('../controllers/ActivityController');

const ActivityRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).single('file'); // Use memory storage

// Create activity route
ActivityRouter.post('/create', ActivityController.CreateActivity);

// Upload to Cloudinary route
ActivityRouter.post('/upload', upload, ActivityController.uploadToCloudinary);

// Fetch all activities route
ActivityRouter.get('/allActivities', ActivityController.getAllActivities);

// Fetch activity by ID route
ActivityRouter.get('/activity/:activityId', ActivityController.getActivity);

// Fetch activity details by ID route
ActivityRouter.get('/activityDetails/:activityId', ActivityController.getActivityDetails);

module.exports = ActivityRouter;