// routes/AdminRouter.js
const express = require('express');
const AdminRouter = express.Router();

// Import the AdminController
const AdminController = require('../controllers/AdminController');

// Route for the Pending Requests
AdminRouter.get('/getPendingRequests', AdminController.getPendingRequests);

// Route to get specific activity details by ID
AdminRouter.get('/activityDetails/:activityId', AdminController.fetchActivityDetailsById);

// route for accepting activities
AdminRouter.post('/acceptActivity/:activityId', AdminController.acceptActivity);

// route for rejecting activities
AdminRouter.post('/rejectActivity/:activityId', AdminController.rejectActivity);

// Route to get all accepted activities (status === 'Accepted')
AdminRouter.get('/fetchAllAcceptedActivities', AdminController.fetchAllAcceptedActivities);

// Route to get all rejected activities (status === 'rejected')
AdminRouter.get('/fetchAllRejectedActivities', AdminController.fetchAllRejectedActivities);

module.exports = AdminRouter;
