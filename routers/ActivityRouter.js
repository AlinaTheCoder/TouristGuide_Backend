const multer = require('multer');
const express = require('express');
const ActivityController = require('../controllers/ActivityController');

const ActivityRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).single('file'); // Use memory storage

ActivityRouter.post('/create', ActivityController.CreateActivity);
ActivityRouter.post('/upload', upload, ActivityController.uploadToCloudinary);

module.exports = ActivityRouter;