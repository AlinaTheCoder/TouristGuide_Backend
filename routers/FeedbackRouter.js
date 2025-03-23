// routers/FeedbackRouter.js
const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/FeedbackController');

// Submit feedback
router.post('/feedback', FeedbackController.submitFeedback);

// Get all feedback for an activity
router.get('/feedback/activity/:activityId', FeedbackController.getActivityFeedback);

// Get a user's feedback for an activity
router.get('/feedback/activity/:activityId/user/:userId', FeedbackController.getUserActivityFeedback);

module.exports = router;