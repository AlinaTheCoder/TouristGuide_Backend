// routers/WishlistRouter.js
const express = require('express');
const router = express.Router();
const WishlistController = require('../controllers/WishlistController');

// Endpoint to toggle wishlist status
router.post('/toggleWishlist/:userId/:activityId', WishlistController.toggleWishlistStatus);

// Endpoint to get the *IDs only* (used by WishlistContext)
router.get('/getWishlist/:userId', WishlistController.getWishlistActivities);

// NEW endpoint: returns full details for each liked activity
router.get('/getFullWishlistActivities/:userId', WishlistController.getFullWishlistActivities);

module.exports = router;
