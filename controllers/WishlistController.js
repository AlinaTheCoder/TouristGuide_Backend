// controllers/WishlistController.js
const { db } = require('../config/db');

exports.toggleWishlistStatus = async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    if (!userId || !activityId) {
      return res.status(400).json({ success: false, message: "Missing userId or activityId" });
    }

    // Check current status
    const wishlistRef = db.ref(`wishlist/${userId}/${activityId}`);
    const snapshot = await wishlistRef.once('value');
    const current = snapshot.val();

    if (current === true) {
      // If already liked, remove it
      await wishlistRef.remove();
      return res.status(200).json({ success: true, liked: false });
    } else {
      // Otherwise, set it to true
      await wishlistRef.set(true);
      return res.status(200).json({ success: true, liked: true });
    }
  } catch (error) {
    console.error("[WishlistController] toggleWishlistStatus error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getWishlistActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const wishlistRef = db.ref(`wishlist/${userId}`);
    const snapshot = await wishlistRef.once('value');
    if (!snapshot.exists()) {
      // No wishlist found
      return res.status(200).json({ success: true, data: [] });
    }

    // Build a list of activityIds the user liked
    const data = snapshot.val(); // e.g. { activity1: true, activity2: true }
    const likedActivityIds = Object.keys(data).filter(id => data[id] === true);

    return res.status(200).json({ success: true, data: likedActivityIds });
  } catch (error) {
    console.error("[WishlistController] getWishlistActivities error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
