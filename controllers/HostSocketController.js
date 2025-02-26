const { db } = require('../config/db'); // If you have { db } in your config/db.js

/**
 * Sets up real-time listeners on the 'activities' node in Firebase,
 * emitting Socket.IO events whenever something changes.
 *
 * @param {SocketIO.Server} io - The Socket.IO server instance
 */
exports.setupHostActivitiesSocket = (io) => {
  // Listen for new activities
  db.ref('activities').on('child_added', (snapshot) => {
    const newData = snapshot.val();
    const activityId = snapshot.key;

    console.log('[SOCKET] Activity added:', activityId, newData);
    io.emit('activities-changed', { activityId, updatedData: newData });
  });

  // Listen for updated activities
  db.ref('activities').on('child_changed', (snapshot) => {
    const updatedData = snapshot.val();
    const activityId = snapshot.key;

    console.log('[SOCKET] Activity changed:', activityId, updatedData);
    io.emit('activities-changed', { activityId, updatedData });
  });

  // Listen for removed activities
  db.ref('activities').on('child_removed', (snapshot) => {
    const removedData = snapshot.val();
    const activityId = snapshot.key;

    console.log('[SOCKET] Activity removed:', activityId, removedData);
    io.emit('activities-removed', { activityId, removedData });
  });
};