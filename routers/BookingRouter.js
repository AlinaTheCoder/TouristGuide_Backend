// routers/BookingRouter.js
const express = require('express');
const BookingController = require('../controllers/BookingController');
const BookingRouter = express.Router();

// GET time slots for a specific date
BookingRouter.get('/getTimeSlots/:activityId', BookingController.getTimeSlotsForDate);

// POST to book time slot
BookingRouter.post('/bookTimeSlot/:activityId', BookingController.bookTimeSlot);

// Create PaymentIntent
BookingRouter.post('/createPaymentIntent/:activityId', BookingController.createPaymentIntent);

module.exports = BookingRouter;
