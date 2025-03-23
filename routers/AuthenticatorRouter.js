const express = require('express');


const AuthenticatorRouter = express.Router();
const AuthenticatorController = require('../controllers/AuthenticatorController');


AuthenticatorRouter.post('/login', AuthenticatorController.Login);
AuthenticatorRouter.post('/googleLogin', AuthenticatorController.LoginWithGoogle);
AuthenticatorRouter.post('/signup', AuthenticatorController.Signup);
// Add to routers/AuthenticatorRouter.js
AuthenticatorRouter.post('/checkEmailProvider', AuthenticatorController.CheckEmailProvider);



module.exports = AuthenticatorRouter;
