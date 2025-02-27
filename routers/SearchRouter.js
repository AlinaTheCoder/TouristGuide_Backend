// routers/SearchRouter.js
const express = require('express');
const router = express.Router();
const { searchActivities } = require('../controllers/SearchController');

// Define POST /search route to perform search filtering
router.post('/search', searchActivities);

module.exports = router;
