// routers/ChatRouter.js
const express = require('express');
const ChatRouter = express.Router();
const ChatController = require('../controllers/ChatController');

// Define route to handle chat requests
ChatRouter.post('/chat', ChatController.handleChatRequest);

module.exports = ChatRouter;