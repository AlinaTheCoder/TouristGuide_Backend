// routers/ExploreSocketRouter.js
const express = require('express');
const router = express.Router();
const { setupExploreActivitiesListener } = require('../controllers/ExploreSocketController');

/**
 * Initialize socket routes.
 * This function takes the Socket.IO instance (io) and calls the realtime listener setup method.
 * You can also add HTTP endpoints here if needed.
 */
const initSocketRoutes = (io) => {
  // Call your controller method to set up the realtime listener for explore activities
  setupExploreActivitiesListener(io);

  // (Optional) Define an HTTP endpoint for testing socket connectivity
  router.get('/socket-test', (req, res) => {
    res.json({ success: true, message: 'Socket endpoint is working' });
  });

  return router;
};

module.exports = initSocketRoutes;
