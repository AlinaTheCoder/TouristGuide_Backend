// index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // For multipart/form-data
require('dotenv').config();
const cron = require('node-cron');
const { cleanupExpiredOTP } = require('./cleanupExpiredOTP');
// Import the global error handler middleware
const errorHandler = require('./middleware/errorHandler');

// 1) Import the Winston logger
const logger = require('./middleware/logger');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

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

// CRON job every 30 minutes
cron.schedule('*/30 * * * *', () => {
  logger.info('[CRON] Running cleanupExpiredOTP...');
  cleanupExpiredOTP();
});

app.get('/', (req, res) => {
  res.send('Backend is running successfully Lalalla!');
});

// Create HTTP server and attach Socket.IO
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

// Initialize the socket routes (this calls setupExploreActivitiesListener internally)
const initSocketRoutes = require('./routers/ExploreSocketRouter');
app.use(initSocketRoutes(io));

// Initialize admin socket routes
const initAdminSocketRoutes = require('./routers/AdminSocketRouter');
app.use(initAdminSocketRoutes(io));

// for the Listings Screen
const initHostSocketRoutes = require('./routers/HostSocketRouter');
app.use(initHostSocketRoutes(io));

// --- Catch-All for Unknown Routes ---
app.use((req, res, next) => {
  logger.warn(`Unknown route accessed: ${req.originalUrl}`);
  res.status(404).send({ error: 'Not Found' });
});

// --- Global Error Handler Middleware ---
app.use(errorHandler);

// --- Process Event Handlers ---
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err}`);
});

// Start the server
const port = process.env.PORT ;
http.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});

