// routers/AnalyticsRouter.js
const express = require('express');
const router = express.Router();
const { getHostBookings } = require('../controllers/AnalyticsController');

// Route to get all bookings for a host
router.get('/analytics/host/:hostId', getHostBookings);

module.exports = router;
