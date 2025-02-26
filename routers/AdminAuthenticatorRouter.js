const express = require('express');

const AdminAuthenticatorRouter = express.Router();
const AdminAuthenticatorController = require('../controllers/AdminAuthenticatorController');

AdminAuthenticatorRouter.post('/adminLogin', AdminAuthenticatorController.Login);
AdminAuthenticatorRouter.post('/adminSignup', AdminAuthenticatorController.Signup);
AdminAuthenticatorRouter.post('/adminlogout', AdminAuthenticatorController.Logout); // unused 
 
module.exports = AdminAuthenticatorRouter;