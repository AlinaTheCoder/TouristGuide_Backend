// cleanupExpiredOTP.js
const { db } = require('./config/db'); // Adjust this path if needed

async function cleanupExpiredOTP() {
  try {
    const now = Date.now();
    const ref = db.ref('emailVerifications');

    // 1. Fetch all records under 'emailVerifications'
    const snapshot = await ref.once('value');
    if (!snapshot.exists()) {
      console.log('[cleanupExpiredOTP] No emailVerifications found.');
      return;
    }

    const updates = {};
    snapshot.forEach((childSnap) => {
      const data = childSnap.val();
      // If expiresAt < now, it's expired => remove it
      if (data.expiresAt && data.expiresAt < now) {
        updates[childSnap.key] = null; // null means deletion in RTDB
      }
    });

    // 2. If there are expired entries, remove them
    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
      console.log('[cleanupExpiredOTP] Removed expired OTP entries:', updates);
    } else {
      console.log('[cleanupExpiredOTP] No expired OTP entries found.');
    }
  } catch (error) {
    console.error('[cleanupExpiredOTP] Error during cleanup:', error);
  }
}

// If run directly (e.g., "node cleanupExpiredOTP.js"), execute the function
if (require.main === module) {
  cleanupExpiredOTP().then(() => process.exit(0));
}

// Export for usage in index.js
module.exports = { cleanupExpiredOTP };
