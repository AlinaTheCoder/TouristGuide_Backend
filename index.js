// index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // For multipart/form-data
require('dotenv').config();
// Import the global error handler middleware
const errorHandler = require('./middleware/errorHandler');
// Import the centralized cron jobs manager
const { initAllScheduledTasks } = require('./utils/CronJobs');
// Import the Winston logger
const logger = require('./middleware/logger');


const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());


// Health check endpoint that doesn't require database connection
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});


// For file uploads
const upload = multer({ storage: multer.memoryStorage() });


// Existing routers
const AuthenticatorRouter = require('./routers/AuthenticatorRouter');
app.use(AuthenticatorRouter);


const UserProfileRouter = require('./routers/UserProfileRouter');
app.use(UserProfileRouter);


const AdminAuthenticatorRouter = require('./routers/AdminAuthenticatorRouter');
app.use(AdminAuthenticatorRouter);


const ActivityRouter = require('./routers/ActivityRouter');
app.use(ActivityRouter);


const AdminRouter = require('./routers/AdminRouter');
app.use(AdminRouter);


const HostRouter = require('./routers/HostRouter');
app.use(HostRouter);


const ExploreRouter = require('./routers/ExploreRouter');
app.use(ExploreRouter);


const BookingRouter = require('./routers/BookingRouter');
app.use(BookingRouter);


const WishlistRouter = require('./routers/WishlistRouter');
app.use(WishlistRouter);


const emailVerificationRouter = require('./routers/EmailVerificationRouter');
app.use('/email', emailVerificationRouter);


const searchRouter = require('./routers/SearchRouter');
app.use(searchRouter);


const scheduleRouter = require('./routers/ScheduleRouter');
app.use('/schedule', scheduleRouter);


const AnalyticsRouter = require('./routers/AnalyticsRouter');
app.use(AnalyticsRouter);


const TripRouter = require('./routers/TripRouter');
app.use(TripRouter);


const FeedbackRouter = require('./routers/FeedbackRouter');
app.use(FeedbackRouter);


const { setupUserProfileSyncListeners } = require('./utils/userProfileSync');
// Initialize user profile sync listeners
try {
  setupUserProfileSyncListeners();
} catch (error) {
  logger.error('Error setting up user profile sync listeners:', error);
}


const earningsRouter = require('./routers/EarningsRouter');
app.use('/earnings', earningsRouter);


// Initialize all cron jobs and startup tasks
try {
  initAllScheduledTasks();
} catch (error) {
  logger.error('Error initializing scheduled tasks:', error);
}


app.get('/', (req, res) => {
  res.send('Backend is running successfully Lalalla!');
});


// Replace your current Socket.IO initialization with this:
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Explicitly define transports
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize the socket routes (this calls setupExploreActivitiesListener internally)
try {
  const initSocketRoutes = require('./routers/ExploreSocketRouter');
  app.use(initSocketRoutes(io));
} catch (error) {
  logger.error('Error initializing explore socket routes:', error);
}


// Initialize admin socket routes
try {
  const initAdminSocketRoutes = require('./routers/AdminSocketRouter');
  app.use(initAdminSocketRoutes(io));
} catch (error) {
  logger.error('Error initializing admin socket routes:', error);
}


// for the Listings Screen
try {
  const initHostSocketRoutes = require('./routers/HostSocketRouter');
  app.use(initHostSocketRoutes(io));
} catch (error) {
  logger.error('Error initializing host socket routes:', error);
}


// --- Catch-All for Unknown Routes ---
app.use((req, res, next) => {
  logger.warn(`Unknown route accessed: ${req.originalUrl}`);
  res.status(404).send({ error: 'Not Found' });
});


// --- Global Error Handler Middleware ---
app.use(errorHandler);


// --- Process Event Handlers ---
// More informative process error handlers with graceful shutdown
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  // Keep the process running for non-critical errors
});


process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err}`);
 
  // Don't crash for Firebase configuration issues
  if (err.message && (err.message.includes('Cannot find module') || err.message.includes('firebase'))) {
    logger.error('Firebase configuration error. Check environment variables.');
    // Continue running to allow health checks to pass
  } else {
    // For critical errors, log and give a moment for logs to be written
    logger.error('Critical error detected, application will restart in 1 second');
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});


// Start the server
const port = process.env.PORT || 8080;
http.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});
