
const express = require('express');
const router = express.Router();

// Import the function that sets up the real-time listeners
const { setupHostActivitiesSocket } = require('../controllers/HostSocketController');

module.exports = (io) => {
  // Initialize the real-time listeners for host activities
  setupHostActivitiesSocket(io);

  return router;
};