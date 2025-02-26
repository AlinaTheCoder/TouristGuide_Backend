const express = require('express');
const ExploreRouter = express.Router();
const ExploreController = require('../controllers/ExploreController');

// Define route to get all listed explore activities
ExploreRouter.get('/getAllListedExploreActivities', ExploreController.getAllListedExploreActivities);

module.exports = ExploreRouter;
