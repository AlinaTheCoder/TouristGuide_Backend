const express = require('express');

const HostRouter = express.Router();
const HostController= require('../controllers/HostController');

HostRouter.get('/getAllListedActivitiesByHostId/:hostId', HostController.getAllListedActivitiesByHostId);

 
module.exports = HostRouter;