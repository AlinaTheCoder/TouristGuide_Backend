// routers/TripRouter.js
const express = require('express');
const router = express.Router();
const { getUserTrips } = require('../controllers/TripController');

// GET all user trips
router.get('/trips/user/:userId', getUserTrips);

module.exports = router;
