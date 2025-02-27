// index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // For multipart/form-data
const upload = multer({ storage: multer.memoryStorage() });
require('dotenv').config();
const cron = require('node-cron');
const { cleanupExpiredOTP } = require('./cleanupExpiredOTP');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

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

// CRON job every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('[CRON] Running cleanupExpiredOTP...');
  cleanupExpiredOTP();
});

app.get('/', (req, res) => res.send('Backend is running successfully Lalalla!'));

// Create HTTP server and attach Socket.IO
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

// Initialize the socket routes (this calls setupExploreActivitiesListener internally)
const initSocketRoutes = require('./routers/ExploreSocketRouter');
app.use(initSocketRoutes(io));

// Initialize admin socket routes
const initAdminSocketRoutes = require('./routers/AdminSocketRouter');
app.use(initAdminSocketRoutes(io));

// Start the server
const port = process.env.PORT || 53783;
http.listen(port, () => {
  console.log(`Server running at http://10.0.2.2:${port}`);
});
