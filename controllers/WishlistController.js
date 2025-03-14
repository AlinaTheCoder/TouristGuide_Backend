// controllers/WishlistController.js
const { db, admin } = require('../config/db');
const logger = require('../middleware/logger');

exports.toggleWishlistStatus = async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    if (!userId || !activityId) {
      return res.status(400).json({ success: false, message: "Missing userId or activityId" });
    }

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
    logger.error("[WishlistController] toggleWishlistStatus error:", error);
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
      return res.status(200).json({ success: true, data: [] });
    }

    const data = snapshot.val(); // e.g. { activity1: true, activity2: true }
    const likedActivityIds = Object.keys(data).filter(id => data[id] === true);

    return res.status(200).json({ success: true, data: likedActivityIds });
  } catch (error) {
    logger.error("[WishlistController] getWishlistActivities error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * NEW METHOD:
 * Returns full activity objects for each item in the user’s wishlist
 */
exports.getFullWishlistActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const wishlistRef = db.ref(`wishlist/${userId}`);
    const wishlistSnap = await wishlistRef.once('value');

    if (!wishlistSnap.exists()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const wishlistData = wishlistSnap.val();
    const likedActivityIds = Object.keys(wishlistData).filter(id => wishlistData[id] === true);

    if (likedActivityIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const activitiesRef = db.ref('activities');
    const fetchPromises = likedActivityIds.map(activityId =>
      activitiesRef.child(activityId).once('value')
    );
    const snapshots = await Promise.all(fetchPromises);

    const result = [];
    snapshots.forEach(snap => {
      if (snap.exists()) {
        const data = snap.val();
        result.push({
          id: snap.key,
          activityTitle: data.activityTitle || 'Untitled Activity',
          // We'll store just the first image to match your old logic
          activityImages: data.activityImages ? [data.activityImages[0]] : [],
        });
      }
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("[WishlistController] getFullWishlistActivities error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
