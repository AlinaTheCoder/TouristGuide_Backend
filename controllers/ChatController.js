// controllers/ChatController.js
const logger = require('../middleware/logger');
const { db } = require('../config/db');
const { OpenAI } = require('openai');

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Handles AI chat requests by combining user query with relevant context from the database
 */
exports.handleChatRequest = async (req, res) => {
  try {
    const { message, location, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.'
      });
    }

    logger.debug(`[ChatController] Received chat request: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Get context from database - activities near the specified location
    const contextData = await getContextFromDatabase(location);
    
    // Create a system prompt that gives the AI information about its role and context
    const systemPrompt = createSystemPrompt(contextData);
    
    // Call OpenAI API with the system prompt and user message
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    // Log token usage for monitoring costs
    logger.debug(`[ChatController] Token usage - Input: ${completion.usage?.prompt_tokens}, Output: ${completion.usage?.completion_tokens}`);
    
    return res.status(200).json({
      success: true,
      message: 'Chat response generated successfully.',
      response: completion.choices[0].message.content,
      contextData: { 
        activitiesCount: contextData.activities.length,
        locations: contextData.locations
      }
    });
  } catch (error) {
    logger.error('[ChatController] Error handling chat request:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing chat request.',
      error: error.message
    });
  }
};

/**
 * Creates a detailed system prompt with context from the database
 */
function createSystemPrompt(contextData) {
  // Base information about the assistant's role
  let systemPrompt = `You are a friendly and knowledgeable travel assistant for TouristGuide, a tourism app focused on Pakistan.
  
Your goal is to help users discover and plan activities across Pakistan.

IMPORTANT GUIDELINES:
- Provide accurate, helpful information about Pakistani tourism, attractions, and activities
- Be conversational, warm, and enthusiastic about Pakistan's offerings
- Keep responses concise (2-3 paragraphs maximum)
- If you don't know something, don't make it up - suggest they explore the app instead
- Always provide context-specific responses about Pakistan
- Encourage users to book activities through the TouristGuide app

`;

  // Add specific information about available activities
  if (contextData.activities && contextData.activities.length > 0) {
    systemPrompt += `\nHere are some activities available in our app that you can recommend:\n`;
    
    contextData.activities.slice(0, 5).forEach(activity => {
      systemPrompt += `- ${activity.title} in ${activity.location}: ${activity.description}. Price: ${activity.price}\n`;
    });
  }

  // Add popular destinations if available
  if (contextData.locations && contextData.locations.length > 0) {
    systemPrompt += `\nPopular destinations you can recommend: ${contextData.locations.join(', ')}.\n`;
  }

  return systemPrompt;
}

/**
 * Fetches relevant context data from the database based on user's location
 */
async function getContextFromDatabase(location) {
  try {
    const activitiesRef = db.ref('activities');
    let query = activitiesRef.orderByChild('status').equalTo('Accepted');
    
    if (location) {
      // If we're searching by location, adjust the query
      // This is simplified - actual implementation would depend on your data structure
      query = activitiesRef
        .orderByChild('status')
        .equalTo('Accepted')
        .startAt(location)
        .endAt(location + '\uf8ff');
    }
    
    const snapshot = await query.once('value');
    
    if (!snapshot.exists()) {
      return { activities: [], locations: [] };
    }
    
    const activities = [];
    const locationsSet = new Set();
    
    snapshot.forEach(childSnapshot => {
      const activity = childSnapshot.val();
      
      if (activity.listingStatus === 'List') {
        activities.push({
          id: childSnapshot.key,
          title: activity.activityTitle,
          location: activity.activityLocation?.city || 'Unknown',
          description: activity.activityDescription?.substring(0, 100) + '...',
          price: activity.priceInformation?.price || 'Contact for price'
        });
        
        if (activity.activityLocation?.city) {
          locationsSet.add(activity.activityLocation.city);
        }
      }
    });
    
    return {
      activities,
      locations: Array.from(locationsSet)
    };
  } catch (error) {
    logger.error('[ChatController] Error getting context from database:', error);
    return { activities: [], locations: [] };
  }
}