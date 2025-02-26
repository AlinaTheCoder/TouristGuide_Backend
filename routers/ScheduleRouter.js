// routes/ScheduleRouter.js

const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/ScheduleController');

// GET all activities for a given host
// e.g. GET /schedule/host/:hostId
router.get('/host/:hostId', scheduleController.getHostActivities);

// GET one activity by ID
// e.g. GET /schedule/:activityId
router.get('/:activityId', scheduleController.getActivityById);

// UPDATE an activity by ID
// e.g. PUT /schedule/:activityId
router.put('/:activityId', scheduleController.updateActivity);

module.exports = router;
