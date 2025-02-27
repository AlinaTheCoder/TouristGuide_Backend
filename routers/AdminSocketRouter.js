// routers/AdminSocketRouter.js
const express = require('express');
const router = express.Router();
const { setupAdminSocketListeners } = require('../controllers/AdminSocketController');

/**
 * Initializes admin socket routes.
 * This function accepts the Socket.IO instance (io) and calls the realtime listener setup.
 * Optionally, you can add HTTP endpoints here if needed.
 */
const initAdminSocketRoutes = (io) => {
  // Set up realtime listeners for admin activities
  setupAdminSocketListeners(io);

  // Optional: HTTP endpoint to test socket functionality
  router.get('/admin-socket-test', (req, res) => {
    res.json({ success: true, message: 'Admin socket endpoint is working' });
  });

  return router;
};

module.exports = initAdminSocketRoutes;
