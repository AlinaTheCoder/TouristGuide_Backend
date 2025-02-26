const express = require('express');

const UserProfileRouter = express.Router();
const UserProfileController = require('../controllers/UserProfileController');

UserProfileRouter.get('/users/GetUserById/:uid', UserProfileController.GetUserByID);
UserProfileRouter.get('/hostPersonalInfo/:uid', UserProfileController.GetHostPersonalInfo);
UserProfileRouter.put('/users/EditName/:uid', UserProfileController.EditName);
UserProfileRouter.put('/users/ChangePassword', UserProfileController.ChangePassword);

module.exports = UserProfileRouter;