// routers/EarningsRouter.js
const express = require('express');
const router = express.Router();
const EarningsController = require('../controllers/EarningsController');

// Get host earnings overview
router.get('/host/:hostId', EarningsController.getHostEarnings);

// Record a payment (called after successful Stripe payment)
router.post('/record-payment', EarningsController.recordPayment);

module.exports = router;