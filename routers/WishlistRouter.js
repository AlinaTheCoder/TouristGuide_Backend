// routers/WishlistRouter.js
const express = require('express');
const router = express.Router();
const WishlistController = require('../controllers/WishlistController');

// Endpoint to toggle wishlist status
router.post('/toggleWishlist/:userId/:activityId', WishlistController.toggleWishlistStatus);

// Endpoint to get wishlist activities for a given user (if needed)
router.get('/getWishlist/:userId', WishlistController.getWishlistActivities);

module.exports = router;
