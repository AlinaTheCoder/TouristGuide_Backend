// utils/Admin.js

/**
 * Transforms a childSnapshot into a pending activity object.
 * Returns an object with id, activityTitle, createdAt, and images fields.
 */
function transformPendingActivity(childSnapshot) {
    const activityData = childSnapshot.val();
    return {
      id: childSnapshot.key,
      activityTitle: activityData.activityTitle,
      createdAt: activityData.createdAt,
      images: activityData.activityImages || [],
    };
  }
  
  /**
   * Transforms a childSnapshot into an activity object with a single image.
   * Returns an object with id, activityTitle, and image field.
   * The image field is set to the first element of activityImages if available,
   * otherwise it returns the provided defaultImage.
   */
  function transformActivityImage(childSnapshot, defaultImage = 'No Image') {
    const activityData = childSnapshot.val();
    return {
      id: childSnapshot.key,
      activityTitle: activityData.activityTitle,
      image: (activityData.activityImages && activityData.activityImages[0]) || defaultImage,
    };
  }
  
  module.exports = {
    transformPendingActivity,
    transformActivityImage,
  };
  