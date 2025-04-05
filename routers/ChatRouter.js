// routers/ChatRouter.js
const express = require('express');
const ChatRouter = express.Router();
const ChatController = require('../controllers/ChatController');

// Define route to handle chat requests
ChatRouter.post('/chat', ChatController.handleChatRequest);

// Add this to ChatRouter.js
ChatRouter.get('/test-openai', async (req, res) => {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      // Just test if we can make a simple request
      const result = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5
      });
      
      res.json({ success: true, message: "OpenAI connection successful", result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "OpenAI connection failed", 
        error: error.message,
        key_present: !!process.env.OPENAI_API_KEY,
        key_length: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
      });
    }
  });
module.exports = ChatRouter;