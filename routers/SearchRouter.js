// routers/SearchRouter.js  
const express = require('express');  
const router = express.Router();  
const { searchActivities, getCities } = require('../controllers/SearchController');

// Define POST /search route to perform search filtering  
router.post('/search', searchActivities);

// Define GET /search/cities route to get all unique cities
router.get('/search/cities', getCities);

module.exports = router;